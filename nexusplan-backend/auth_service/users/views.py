from django.conf import settings as django_settings
from django.contrib.auth import authenticate
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Token
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
_PROFILE_TAG = ["Profile"]


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
        return Response(UserProfileSerializer(user).data, status=status.HTTP_201_CREATED)


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

        user = authenticate(
            request,
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )

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

        return Response(
            {
                "access": access_token,
                "refresh": refresh_token,
                "user": UserProfileSerializer(user).data,
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

        try:
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                django_settings.GOOGLE_CLIENT_ID,
            )

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

            return Response(
                {
                    "access": access_token,
                    "refresh": refresh_token,
                    "user": UserProfileSerializer(user).data,
                },
                status=status.HTTP_200_OK,
            )

        except ValueError:
            # Invalid token
            return Response(
                {"detail": "Invalid Google credential."},
                status=status.HTTP_400_BAD_REQUEST,
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

    @extend_schema(
        summary="Get current user profile",
        responses={200: UserProfileSerializer},
        tags=_PROFILE_TAG,
    )
    def get(self, request: Request) -> Response:
        return Response(
            UserProfileSerializer(request.user).data,
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
            request.user, data=request.data, partial=True
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
