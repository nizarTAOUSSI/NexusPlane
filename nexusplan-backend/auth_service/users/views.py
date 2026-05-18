import json
import time
import logging
import requests as http_requests

import redis as redis_client
from django.conf import settings as django_settings
from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google.auth.exceptions import GoogleAuthError
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Token, User
from .serializers import (
    ChangePasswordSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    GoogleLoginSerializer,
)

_AUTH_TAG = ["Authentication"]
_INTERNAL_TAG = ["Internal"]
_PROFILE_TAG = ["Profile"]
_ADMIN_TAG = ["Admin"]
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Redis helper — caches user info for other services to look up
# ---------------------------------------------------------------------------

_USER_CACHE_TTL = 60 * 60 * 24 * 7  # 7 days


def _get_redis():
    return redis_client.Redis.from_url(
        django_settings.REDIS_URL, decode_responses=True
    )


def _cache_user(user) -> None:
    """Write user profile to Redis so project_service can resolve email → id."""
    try:
        r = _get_redis()
        data = json.dumps({
            "id":       str(user.id),
            "email":    user.email,
            "username": user.username or "",
            "avatar":   user.avatar or "",
        })
        r.set(f"user:id:{user.id}",              data, ex=_USER_CACHE_TTL)
        r.set(f"user:email:{user.email.lower()}", data, ex=_USER_CACHE_TTL)
    except Exception:  # Redis unavailable — non-fatal
        pass


def _require_superuser(request: Request) -> Response | None:
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication credentials were not provided."}, status=status.HTTP_401_UNAUTHORIZED)
    if not request.user.is_superuser:
        return Response({"detail": "Only superusers can access this endpoint."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _internal_headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Internal-Key": getattr(django_settings, "INTERNAL_API_KEY", ""),
        "Host": "localhost",
    }

# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


class RegisterView(APIView):
    """Create a new user account."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Register a new user",
        request=RegisterSerializer,
        responses={
            201: UserProfileSerializer,
            400: OpenApiResponse(description="Validation error"),
        },
        tags=_AUTH_TAG,
    )
    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        _cache_user(user)  # publish to Redis for other services
        return Response(
            UserProfileSerializer(user, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


class LoginView(APIView):
    """Authenticate with email and password; receive a JWT token pair."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Login — obtain a JWT token pair",
        request=LoginSerializer,
        responses={
            200: LoginResponseSerializer,
            401: OpenApiResponse(description="Invalid credentials"),
        },
        tags=_AUTH_TAG,
    )
    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]

        user = authenticate(
            request,
            email=email,
            username=email,
            password=password,
        )

        # Fallback for edge-cases where backend lookup fails (e.g., case mismatch)
        # but credentials are otherwise valid.
        if user is None:
            UserModel = get_user_model()
            existing = UserModel.objects.filter(email__iexact=email).first()

            if existing and existing.check_password(password):
                if not existing.is_active:
                    return Response(
                        {"detail": "This account is disabled."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                user = existing

        if user is None:
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        access_lifetime = django_settings.SIMPLE_JWT.get("ACCESS_TOKEN_LIFETIME")
        Token.objects.create(
            user=user,
            accessToken=access_token,
            refreshToken=refresh_token,
            expiresAt=timezone.now() + access_lifetime,
        )

        _cache_user(user)  # refresh Redis cache on every login

        return Response(
            {
                "access": access_token,
                "refresh": refresh_token,
                "user": UserProfileSerializer(user, context={"request": request}).data,
                "provider": "local" ,
            },
            status=status.HTTP_200_OK,
        )

class GoogleLoginView(APIView):
    """Authenticate with Google ID token; receive a JWT token pair."""

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Google Login — verify credential and obtain JWT",
        request=GoogleLoginSerializer,
        responses={
            200: LoginResponseSerializer,
            400: OpenApiResponse(description="Invalid credential"),
        },
        tags=_AUTH_TAG,
    )
    def post(self, request: Request) -> Response:
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        credential = serializer.validated_data["credential"]

        client_id = django_settings.GOOGLE_CLIENT_ID
        if not client_id:
            return Response(
                {"detail": "Google Sign-In is not configured on the server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        idinfo = None
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                req = google_requests.Request()
                idinfo = id_token.verify_oauth2_token(
                    credential,
                    req,
                    client_id,
                    clock_skew_in_seconds=10,
                )
                break
            except (ValueError, GoogleAuthError) as exc:
                last_error = exc
                logger.warning("Google token verify attempt %s failed: %s", attempt + 1, exc)
            except Exception as exc:  # noqa: BLE001 — cert fetch / transport blips
                last_error = exc
                logger.warning("Google token verify transport error (attempt %s): %s", attempt + 1, exc)
            if attempt < 2:
                time.sleep(0.2 * (attempt + 1))

        if idinfo is None:
            if last_error:
                logger.info("Google credential rejected after retries: %s", last_error)
            return Response(
                {"detail": "Invalid Google credential."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            email = idinfo.get("email")
            name = idinfo.get("name", "")
            picture = idinfo.get("picture", None)

            if not email:
                return Response(
                    {"detail": "Google token does not contain email."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from .models import User
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": name or email.split("@")[0],
                    "avatar": picture,
                }
            )

            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)

            access_lifetime = django_settings.SIMPLE_JWT.get("ACCESS_TOKEN_LIFETIME")
            Token.objects.create(
                user=user,
                accessToken=access_token,
                refreshToken=refresh_token,
                expiresAt=timezone.now() + access_lifetime,
            )

            _cache_user(user)  # refresh Redis cache on every Google login

            return Response(
                {
                    "access": access_token,
                    "refresh": refresh_token,
                    "user": UserProfileSerializer(user, context={"request": request}).data,
                    "provider": "google",
                },
                status=status.HTTP_200_OK,
            )

        except Exception as exc:  # noqa: BLE001
            logger.exception("Google login persistence failed: %s", exc)
            return Response(
                {"detail": "Could not complete sign-in. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


class LogoutView(APIView):
    """Blacklist the refresh token and invalidate the stored token record."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Logout — blacklist the refresh token",
        request=LogoutSerializer,
        responses={
            204: OpenApiResponse(description="Successfully logged out"),
            400: OpenApiResponse(description="Invalid or missing refresh token"),
        },
        tags=_AUTH_TAG,
    )
    def post(self, request: Request) -> Response:
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "The 'refresh' field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Mark the token record as invalid in our audit table
        Token.objects.filter(
            user=request.user,
            refreshToken=refresh_token,
            isValid=True,
        ).update(isValid=False)

        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Profile (read + partial update)
# ---------------------------------------------------------------------------


class UpdateProfileView(APIView):
    """Retrieve or partially update the authenticated user's profile."""

    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(
        summary="Get current user profile",
        responses={200: UserProfileSerializer},
        tags=_PROFILE_TAG,
    )
    def get(self, request: Request) -> Response:
        return Response(
            UserProfileSerializer(request.user, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        summary="Update current user profile (partial)",
        request=UserProfileSerializer,
        responses={
            200: UserProfileSerializer,
            400: OpenApiResponse(description="Validation error"),
        },
        tags=_PROFILE_TAG,
    )
    def patch(self, request: Request) -> Response:
        serializer = UserProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Change password
# ---------------------------------------------------------------------------


class ChangePasswordView(APIView):
    """Change the authenticated user's password and invalidate active tokens."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Change current user's password",
        request=ChangePasswordSerializer,
        responses={
            200: OpenApiResponse(description="Password changed successfully"),
            400: OpenApiResponse(description="Validation error or wrong old password"),
        },
        tags=_PROFILE_TAG,
    )
    def post(self, request: Request) -> Response:
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"old_password": "Wrong password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data["new_password"])
        user.save()

        Token.objects.filter(user=user, isValid=True).update(isValid=False)

        return Response(
            {"detail": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Internal — lookup user by email (used by project_service for invite flow)
# ---------------------------------------------------------------------------


class LookupByEmailView(APIView):
    """
    Internal endpoint: given an email, return the user profile.
    Returns 404 if no user with that email exists.
    This endpoint is called by project_service to resolve userId before
    creating a Membership and sending an invitation email.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Look up a user by email (internal)",
        parameters=[
            OpenApiParameter(
                name="email",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=True,
                description="The email address to look up.",
            )
        ],
        responses={
            200: UserProfileSerializer,
            400: OpenApiResponse(description="Missing email parameter."),
            404: OpenApiResponse(description="No user with that email."),
        },
        tags=_INTERNAL_TAG,
    )
    def get(self, request: Request) -> Response:
        email = request.query_params.get("email", "").strip()
        if not email:
            return Response(
                {"detail": "'email' query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .models import User

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {"detail": "No user found with that email address."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            UserProfileSerializer(user, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class LookupByIdView(APIView):
    """
    Internal: look up a single user by UUID.
    GET /api/auth/lookup-by-id/?id=<uuid>
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Look up a user by ID (internal)",
        parameters=[
            OpenApiParameter(name="id", type=OpenApiTypes.UUID,
                             location=OpenApiParameter.QUERY, required=True)
        ],
        responses={200: UserProfileSerializer, 404: OpenApiResponse(description="Not found.")},
        tags=_INTERNAL_TAG,
    )
    def get(self, request: Request) -> Response:
        from .models import User
        uid = request.query_params.get("id", "").strip()
        if not uid:
            return Response({"detail": "'id' query parameter is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=uid)
        except (User.DoesNotExist, Exception):
            return Response({"detail": "No user found with that id."},
                            status=status.HTTP_404_NOT_FOUND)
        return Response(
            UserProfileSerializer(user, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class LookupByIdsView(APIView):
    """
    Internal: batch look up users by a comma-separated list of UUIDs.
    GET /api/auth/lookup-by-ids/?ids=<uuid1>,<uuid2>,...
    Returns a list (missing ids are silently skipped).
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Batch look up users by IDs (internal)",
        parameters=[
            OpenApiParameter(name="ids", type=OpenApiTypes.STR,
                             location=OpenApiParameter.QUERY, required=True,
                             description="Comma-separated UUIDs.")
        ],
        responses={200: UserProfileSerializer(many=True)},
        tags=_INTERNAL_TAG,
    )
    def get(self, request: Request) -> Response:
        from .models import User
        raw = request.query_params.get("ids", "").strip()
        if not raw:
            return Response([], status=status.HTTP_200_OK)
        uid_list = [u.strip() for u in raw.split(",") if u.strip()]
        users = User.objects.filter(id__in=uid_list)
        return Response(
            UserProfileSerializer(users, many=True, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class AdminUsersView(APIView):
    """Superuser-only endpoint: list all users."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Admin: get all users",
        responses={200: UserProfileSerializer(many=True), 403: OpenApiResponse(description="Superuser required")},
        tags=_ADMIN_TAG,
    )
    def get(self, request: Request) -> Response:
        forbidden = _require_superuser(request)
        if forbidden:
            return forbidden

        from .models import User

        users = User.objects.all().order_by("-createdAt")
        data = UserProfileSerializer(users, many=True, context={"request": request}).data
        return Response(data, status=status.HTTP_200_OK)


class AdminAIRequestLogsView(APIView):
    """Superuser-only endpoint: fetch AI request logs from ai_service."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Admin: get AI request logs",
        responses={200: OpenApiTypes.OBJECT, 403: OpenApiResponse(description="Superuser required")},
        tags=_ADMIN_TAG,
    )
    def get(self, request: Request) -> Response:
        forbidden = _require_superuser(request)
        if forbidden:
            return forbidden

        ai_url = getattr(django_settings, "AI_SERVICE_URL", "http://ai_service:8000").rstrip("/")
        endpoint = f"{ai_url}/api/internal/ai-request-logs/"

        try:
            resp = http_requests.get(endpoint, headers=_internal_headers(), timeout=10)
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": f"Failed to contact ai_service: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if resp.status_code != 200:
            return Response(
                {"detail": "ai_service returned an error", "status": resp.status_code, "body": (resp.text or "")[:500]},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(resp.json(), status=status.HTTP_200_OK)


class AdminProjectsWithMembersView(APIView):
    """Superuser-only endpoint: fetch all projects with member list from project_service."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Admin: get all projects with members",
        responses={200: OpenApiTypes.OBJECT, 403: OpenApiResponse(description="Superuser required")},
        tags=_ADMIN_TAG,
    )
    def get(self, request: Request) -> Response:
        forbidden = _require_superuser(request)
        if forbidden:
            return forbidden

        project_url = getattr(django_settings, "PROJECT_SERVICE_URL", "http://project_service:8000").rstrip("/")
        endpoint = f"{project_url}/api/internal/projects-with-members/"

        try:
            resp = http_requests.get(endpoint, headers=_internal_headers(), timeout=10)
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": f"Failed to contact project_service: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if resp.status_code != 200:
            return Response(
                {"detail": "project_service returned an error", "status": resp.status_code, "body": (resp.text or "")[:500]},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(resp.json(), status=status.HTTP_200_OK)


class AdminBanUserView(APIView):
    """Superuser-only endpoint: ban (deactivate) a user account."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Admin: ban user",
        responses={
            200: OpenApiTypes.OBJECT,
            403: OpenApiResponse(description="Superuser required"),
            404: OpenApiResponse(description="User not found"),
        },
        tags=_ADMIN_TAG,
    )
    def post(self, request: Request, user_id: str) -> Response:
        forbidden = _require_superuser(request)
        if forbidden:
            return forbidden

        try:
            target = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if str(target.id) == str(request.user.id):
            return Response(
                {"detail": "You cannot ban your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if target.is_superuser:
            return Response(
                {"detail": "You cannot ban a superuser account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target.is_active = False
        target.is_online = False
        target.save(update_fields=["is_active", "is_online", "updatedAt"])
        Token.objects.filter(user=target, isValid=True).update(isValid=False)

        return Response(
            {
                "detail": "User banned successfully.",
                "userId": str(target.id),
                "email": target.email,
                "is_active": target.is_active,
            },
            status=status.HTTP_200_OK,
        )


class AdminUpdateUserView(APIView):
    """Superuser-only endpoint: partially update a user by user id."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Admin: update user by id",
        request=OpenApiTypes.OBJECT,
        responses={
            200: OpenApiTypes.OBJECT,
            400: OpenApiResponse(description="Invalid payload"),
            403: OpenApiResponse(description="Superuser required"),
            404: OpenApiResponse(description="User not found"),
        },
        tags=_ADMIN_TAG,
    )
    def patch(self, request: Request, user_id: str) -> Response:
        forbidden = _require_superuser(request)
        if forbidden:
            return forbidden

        try:
            target = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        payload = request.data if isinstance(request.data, dict) else {}
        if not payload:
            return Response(
                {"detail": "Provide at least one field to update."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_fields = {"email", "username", "avatar", "role", "is_active", "is_staff", "is_superuser"}
        unknown_fields = [k for k in payload.keys() if k not in allowed_fields]
        if unknown_fields:
            return Response(
                {"detail": f"Unsupported fields: {', '.join(unknown_fields)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        def _parse_bool(v):
            if isinstance(v, bool):
                return v
            if isinstance(v, str):
                s = v.strip().lower()
                if s in {"true", "1", "yes"}:
                    return True
                if s in {"false", "0", "no"}:
                    return False
            raise ValueError("Expected boolean value")

        # Identity fields
        if "email" in payload:
            new_email = str(payload.get("email") or "").strip().lower()
            if not new_email:
                return Response({"detail": "email cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
            email_exists = User.objects.filter(email__iexact=new_email).exclude(id=target.id).exists()
            if email_exists:
                return Response({"detail": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)
            target.email = new_email

        if "username" in payload:
            new_username = str(payload.get("username") or "").strip()
            if not new_username:
                return Response({"detail": "username cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)
            target.username = new_username

        if "avatar" in payload:
            avatar_val = payload.get("avatar")
            target.avatar = str(avatar_val).strip() if avatar_val is not None else ""

        if "role" in payload:
            role_val = str(payload.get("role") or "").strip().upper()
            valid_roles = {choice[0] for choice in User._meta.get_field("role").choices}
            if role_val not in valid_roles:
                return Response(
                    {"detail": f"Invalid role. Allowed values: {', '.join(sorted(valid_roles))}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target.role = role_val

        # Privileged flags
        try:
            deactivated = False
            if "is_active" in payload:
                new_is_active = _parse_bool(payload.get("is_active"))
                if str(target.id) == str(request.user.id) and not new_is_active:
                    return Response({"detail": "You cannot deactivate your own account."}, status=status.HTTP_400_BAD_REQUEST)
                if target.is_superuser and not new_is_active:
                    return Response({"detail": "Superuser accounts cannot be deactivated."}, status=status.HTTP_400_BAD_REQUEST)
                target.is_active = new_is_active
                deactivated = not new_is_active

            if "is_staff" in payload:
                new_is_staff = _parse_bool(payload.get("is_staff"))
                if str(target.id) == str(request.user.id) and not new_is_staff:
                    return Response({"detail": "You cannot remove your own staff access."}, status=status.HTTP_400_BAD_REQUEST)
                target.is_staff = new_is_staff

            if "is_superuser" in payload:
                new_is_superuser = _parse_bool(payload.get("is_superuser"))
                if str(target.id) == str(request.user.id) and not new_is_superuser:
                    return Response({"detail": "You cannot remove your own superuser access."}, status=status.HTTP_400_BAD_REQUEST)
                target.is_superuser = new_is_superuser
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        target.save()
        if deactivated:
            Token.objects.filter(user=target, isValid=True).update(isValid=False)
        _cache_user(target)

        return Response(
            {
                "detail": "User updated successfully.",
                "user": UserProfileSerializer(target, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )
