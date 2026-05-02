import urllib.parse

import requests as http_requests
from django.conf import settings as django_settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Membership, Project, ProjectStatus
from .serializers import (
    MembershipCreateSerializer,
    MembershipSerializer,
    MembershipUpdateRoleSerializer,
    ProjectSerializer,
    ProjectUpdateSerializer,
)

_PROJECT_TAG = ["Projects"]
_MEMBERSHIP_TAG = ["Memberships"]


# ---------------------------------------------------------------------------
# Email helper functions
# ---------------------------------------------------------------------------

_ROLE_LABEL = {
    "VIEWER": "Viewer",
    "CONTRIBUTOR": "Contributor",
    "MANAGER": "Manager",
}

_ROLE_COLOR = {
    "VIEWER": "#6366F1",
    "CONTRIBUTOR": "#10B981",
    "MANAGER": "#F59E0B",
}

_BASE_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#0F0F13;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#0F0F13;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;">

        <!-- Header -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="width:40px;height:40px;border-radius:12px;
                          background:linear-gradient(135deg,#6366F1,#8B5CF6);
                          display:inline-block;vertical-align:middle;"></div>
              <span style="font-size:22px;font-weight:800;color:#FFFFFF;
                           letter-spacing:-0.5px;vertical-align:middle;">
                Nexus<span style="font-weight:300;">Plan</span>
              </span>
            </div>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#1A1A24;border-radius:20px;
                     border:1px solid rgba(255,255,255,0.08);
                     box-shadow:0 24px 64px rgba(0,0,0,0.5);
                     overflow:hidden;">

            <!-- Top accent bar -->
            <div style="height:4px;background:linear-gradient(90deg,#6366F1,#8B5CF6,#EC4899);"></div>

            <!-- Body -->
            <div style="padding:40px 40px 36px;">
              {body}
            </div>

            <!-- Footer -->
            <div style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:#4B4B6B;text-align:center;line-height:1.7;">
                You received this email because someone invited you to NexusPlan.<br/>
                If you believe this is a mistake, you can safely ignore this email.
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#36364A;text-align:center;">
                &copy; {year} NexusPlan &mdash; All rights reserved
              </p>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def _role_badge(role: str) -> str:
    color = _ROLE_COLOR.get(role, "#6366F1")
    label = _ROLE_LABEL.get(role, role.title())
    return (
        f'<span style="display:inline-block;background:{color}20;color:{color};'
        f'border:1px solid {color}40;border-radius:999px;'
        f'padding:3px 14px;font-size:12px;font-weight:700;'
        f'text-transform:uppercase;letter-spacing:0.07em;">{label}</span>'
    )


def _send_existing_user_invite(
    *,
    to_email: str,
    username: str,
    project_name: str,
    role: str,
    project_url: str,
    frontend_url: str,
) -> None:
    """Send an invitation email to a user who already has a NexusPlan account."""
    from datetime import date

    subject = f"You've been invited to \"{project_name}\" on NexusPlan"

    body = f"""
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;
                color:#6366F1;text-transform:uppercase;letter-spacing:0.1em;">
        Project Invitation
      </p>
      <h1 style="margin:0 0 18px;font-size:26px;font-weight:800;
                 color:#FFFFFF;letter-spacing:-0.5px;line-height:1.2;">
        You've been invited to collaborate
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9090B0;line-height:1.7;">
        Hi <strong style="color:#FFFFFF;">{username}</strong>, someone has added you to a
        project on NexusPlan. You can now access it with the following role:
      </p>

      <!-- Project card -->
      <div style="background:#12121C;border:1px solid rgba(255,255,255,0.08);
                  border-radius:14px;padding:22px 24px;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#4B4B6B;
                  text-transform:uppercase;letter-spacing:0.09em;">Project</p>
        <p style="margin:0 0 16px;font-size:20px;font-weight:800;color:#FFFFFF;
                  letter-spacing:-0.3px;">{project_name}</p>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#4B4B6B;
                  text-transform:uppercase;letter-spacing:0.09em;">Your Role</p>
        {_role_badge(role)}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="{project_url}"
           style="display:inline-block;background:linear-gradient(135deg,#6366F1,#8B5CF6);
                  color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;
                  padding:14px 36px;border-radius:12px;
                  box-shadow:0 8px 24px rgba(99,102,241,0.4);
                  letter-spacing:0.01em;">
          Open Project &rarr;
        </a>
      </div>

      <p style="margin:0;font-size:13px;color:#4B4B6B;text-align:center;line-height:1.6;">
        Or copy this link into your browser:<br/>
        <a href="{project_url}" style="color:#6366F1;font-size:12px;word-break:break-all;">
          {project_url}
        </a>
      </p>
    """

    html_content = _BASE_HTML.format(
        subject=subject, body=body, year=date.today().year
    )
    text_content = (
        f"Hi {username},\n\n"
        f"You've been invited to join \"{project_name}\" on NexusPlan with the role: {role}.\n\n"
        f"Open the project here: {project_url}\n\n"
        f"— The NexusPlan Team"
    )

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        to=[to_email],
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send(fail_silently=True)


def _send_new_user_invite(
    *,
    to_email: str,
    project_name: str,
    role: str,
    register_url: str,
    frontend_url: str,
) -> None:
    """Send an invitation email to someone who doesn't have a NexusPlan account yet."""
    from datetime import date

    subject = f"You're invited to join \"{project_name}\" on NexusPlan"

    body = f"""
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;
                color:#EC4899;text-transform:uppercase;letter-spacing:0.1em;">
        You're Invited
      </p>
      <h1 style="margin:0 0 18px;font-size:26px;font-weight:800;
                 color:#FFFFFF;letter-spacing:-0.5px;line-height:1.2;">
        Join NexusPlan &amp; start collaborating
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9090B0;line-height:1.7;">
        Someone has invited you to collaborate on a project on NexusPlan, the
        modern project management platform. Create your free account to get started.
      </p>

      <!-- Project card -->
      <div style="background:#12121C;border:1px solid rgba(255,255,255,0.08);
                  border-radius:14px;padding:22px 24px;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#4B4B6B;
                  text-transform:uppercase;letter-spacing:0.09em;">You're invited to</p>
        <p style="margin:0 0 16px;font-size:20px;font-weight:800;color:#FFFFFF;
                  letter-spacing:-0.3px;">{project_name}</p>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#4B4B6B;
                  text-transform:uppercase;letter-spacing:0.09em;">Your Role</p>
        {_role_badge(role)}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="{register_url}"
           style="display:inline-block;background:linear-gradient(135deg,#EC4899,#8B5CF6);
                  color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;
                  padding:14px 36px;border-radius:12px;
                  box-shadow:0 8px 24px rgba(236,72,153,0.35);
                  letter-spacing:0.01em;">
          Create Account &amp; Join &rarr;
        </a>
      </div>

      <p style="margin:0;font-size:13px;color:#4B4B6B;text-align:center;line-height:1.6;">
        Or copy this link into your browser:<br/>
        <a href="{register_url}" style="color:#EC4899;font-size:12px;word-break:break-all;">
          {register_url}
        </a>
      </p>
    """

    html_content = _BASE_HTML.format(
        subject=subject, body=body, year=date.today().year
    )
    text_content = (
        f"You've been invited to join \"{project_name}\" on NexusPlan with the role: {role}.\n\n"
        f"Create your free account here: {register_url}\n\n"
        f"— The NexusPlan Team"
    )

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        to=[to_email],
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send(fail_silently=True)


# ---------------------------------------------------------------------------
# ProjectViewSet
# ---------------------------------------------------------------------------


@extend_schema_view(
    list=extend_schema(
        summary="List all projects",
        description=(
            "Returns all non-deleted projects. Supports optional filtering by "
            "`ownerId` and `status` via query parameters."
        ),
        tags=_PROJECT_TAG,
        parameters=[
            OpenApiParameter(
                name="ownerId",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Filter projects by owner UUID (from auth_service).",
                required=False,
            ),
            OpenApiParameter(
                name="status",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["ACTIVE", "ARCHIVED"],
                description="Filter projects by status. DELETED projects are never returned.",
                required=False,
            ),
        ],
    ),
    create=extend_schema(
        summary="Create a new project",
        description=(
            "Creates a project owned by the authenticated user. "
            "The `ownerId` is resolved exclusively from the `X-User-Id` header "
            "injected by the API Gateway after JWT validation — it cannot be "
            "set directly by the client."
        ),
        request=ProjectSerializer,
        responses={
            201: ProjectSerializer,
            400: OpenApiResponse(description="Validation error."),
            422: OpenApiResponse(description="Missing X-User-Id header."),
        },
        parameters=[
            OpenApiParameter(
                name="X-User-Id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.HEADER,
                description=(
                    "UUID of the authenticated user, injected by the API Gateway "
                    "after validating the Bearer JWT token."
                ),
                required=True,
            ),
        ],
        tags=_PROJECT_TAG,
    ),
    retrieve=extend_schema(
        summary="Retrieve a project by UUID",
        responses={
            200: ProjectSerializer,
            404: OpenApiResponse(description="Project not found or deleted."),
        },
        tags=_PROJECT_TAG,
    ),
    update=extend_schema(
        summary="Replace project name / description (full update)",
        request=ProjectUpdateSerializer,
        responses={
            200: ProjectSerializer,
            404: OpenApiResponse(description="Project not found or deleted."),
        },
        tags=_PROJECT_TAG,
    ),
    partial_update=extend_schema(
        summary="Partially update project name / description",
        request=ProjectUpdateSerializer,
        responses={
            200: ProjectSerializer,
            404: OpenApiResponse(description="Project not found or deleted."),
        },
        tags=_PROJECT_TAG,
    ),
    destroy=extend_schema(
        summary="Soft-delete a project",
        description=(
            "Sets the project status to DELETED. The record is retained in the "
            "database for audit purposes and is no longer returned by list / retrieve."
        ),
        responses={204: None},
        tags=_PROJECT_TAG,
    ),
)
class ProjectViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Project resources.

    Authentication is fully delegated to the API Gateway: every request
    reaching this service through the gateway already carries the caller's
    `X-User-Id` header. The service trusts this header and never validates
    JWTs directly.
    """

    permission_classes = [AllowAny]
    serializer_class = ProjectSerializer

    # ------------------------------------------------------------------
    # Queryset / serializer helpers
    # ------------------------------------------------------------------

    def get_queryset(self):
        """Return non-deleted projects, with optional query-param filters."""
        qs = Project.objects.exclude(status=ProjectStatus.DELETED)

        owner_id = self.request.query_params.get("ownerId")
        filter_status = self.request.query_params.get("status")

        if owner_id:
            qs = qs.filter(ownerId=owner_id)
        if filter_status:
            qs = qs.filter(status=filter_status)

        return qs

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return ProjectUpdateSerializer
        return ProjectSerializer

    # ------------------------------------------------------------------
    # Overridden standard actions
    # ------------------------------------------------------------------

    def perform_create(self, serializer):
        """
        Resolves ownerId from the trusted X-User-Id header.

        The API Gateway validates the Bearer JWT and injects the user's UUID
        as X-User-Id before forwarding the request to this service.
        """
        owner_id = self.request.headers.get("X-User-Id")
        if not owner_id:
            raise ValidationError(
                {
                    "ownerId": (
                        "Missing X-User-Id header. "
                        "This endpoint must be called through the API Gateway."
                    )
                }
            )
        serializer.save(ownerId=owner_id)

    def update(self, request: Request, *args, **kwargs) -> Response:
        """
        PUT / PATCH — accepts ProjectUpdateSerializer input,
        returns a full ProjectSerializer response.
        """
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        write_serializer = ProjectUpdateSerializer(
            instance, data=request.data, partial=partial
        )
        write_serializer.is_valid(raise_exception=True)
        project = write_serializer.save()
        return Response(ProjectSerializer(project).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        """Soft-delete: transitions status to DELETED instead of removing the row."""
        project = self.get_object()
        project.status = ProjectStatus.DELETED
        project.save(update_fields=["status", "updatedAt"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Custom actions — UML methods
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Archive a project",
        description=(
            "Transitions project status from ACTIVE → ARCHIVED. "
            "Returns 409 if the project is already ARCHIVED or DELETED."
        ),
        request=None,
        responses={
            200: ProjectSerializer,
            409: OpenApiResponse(
                description="Project is not in ACTIVE status and cannot be archived."
            ),
        },
        tags=_PROJECT_TAG,
    )
    @action(detail=True, methods=["patch"], url_path="archive")
    def archive(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        """Change the project status to ARCHIVED (UML: archive())."""
        project = self.get_object()
        if project.status != ProjectStatus.ACTIVE:
            return Response(
                {
                    "detail": (
                        f"Cannot archive a project with status '{project.status}'. "
                        "Only ACTIVE projects can be archived."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        project.status = ProjectStatus.ARCHIVED
        project.save(update_fields=["status", "updatedAt"])
        return Response(ProjectSerializer(project).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List members of a project",
        description=(
            "Returns all Membership records associated with the project, "
            "including each member's userId, role, and joinedAt timestamp."
        ),
        responses={
            200: MembershipSerializer(many=True),
            404: OpenApiResponse(description="Project not found or deleted."),
        },
        tags=_PROJECT_TAG,
    )
    @action(detail=True, methods=["get"], url_path="members")
    def get_members(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        """Return all Membership records for this project (UML: getMembers())."""
        project = self.get_object()
        memberships = project.memberships.all()
        serializer = MembershipSerializer(memberships, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # Custom action — invite member by email
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Invite a user by email",
        description=(
            "Looks up the email in auth_service. If the user exists, creates a "
            "Membership and sends an invitation email. If not, sends a "
            "registration-invite email asking them to create an account."
        ),
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "email": {"type": "string", "format": "email"},
                    "role": {
                        "type": "string",
                        "enum": ["VIEWER", "CONTRIBUTOR", "MANAGER"],
                        "default": "VIEWER",
                    },
                },
                "required": ["email"],
            }
        },
        responses={
            200: OpenApiResponse(description="Invitation email sent (user already a member)."),
            201: MembershipSerializer,
            400: OpenApiResponse(description="Validation error or already a member."),
            503: OpenApiResponse(description="Could not reach auth_service."),
        },
        tags=_PROJECT_TAG,
    )
    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        """Invite a collaborator to this project by their email address."""
        project = self.get_object()
        email = (request.data.get("email") or "").strip().lower()
        role = (request.data.get("role") or "VIEWER").strip().upper()

        if not email:
            return Response(
                {"detail": "'email' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        auth_url = django_settings.AUTH_SERVICE_URL.rstrip("/")
        try:
            resp = http_requests.get(
                f"{auth_url}/api/auth/lookup/",
                params={"email": email},
                timeout=5,
            )
        except http_requests.RequestException as exc:
            return Response(
                {"detail": f"Could not reach auth_service: {exc}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        user_exists = resp.status_code == 200
        user_data = resp.json() if user_exists else {}
        user_id = user_data.get("id")
        username = user_data.get("username", email.split("@")[0]) if user_exists else email.split("@")[0]

        frontend_url = django_settings.FRONTEND_URL.rstrip("/")

        if user_exists:
            if Membership.objects.filter(projectId=project, userId=user_id).exists():
                return Response(
                    {"detail": "This user is already a member of the project."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            membership = Membership.objects.create(
                projectId=project,
                userId=user_id,
                role=role,
            )

            _send_existing_user_invite(
                to_email=email,
                username=username,
                project_name=project.name,
                role=role,
                project_url=f"{frontend_url}/projects/{project.id}",
                frontend_url=frontend_url,
            )

            return Response(
                MembershipSerializer(membership).data,
                status=status.HTTP_201_CREATED,
            )
        else:
            register_url = (
                f"{frontend_url}/signup"
                f"?invite_project={project.id}"
                f"&invite_role={role}"
                f"&email={urllib.parse.quote(email)}"
            )
            _send_new_user_invite(
                to_email=email,
                project_name=project.name,
                role=role,
                register_url=register_url,
                frontend_url=frontend_url,
            )
            return Response(
                {"detail": "No account found. A registration invitation has been sent."},
                status=status.HTTP_202_ACCEPTED,
            )



# ---------------------------------------------------------------------------
# MembershipViewSet
# ---------------------------------------------------------------------------


@extend_schema_view(
    create=extend_schema(
        summary="Invite a user to a project",
        description=(
            "Creates a Membership record linking a userId (UUID from auth_service) "
            "to a project with a given role. Returns 400 if the user is already "
            "a member of that project."
        ),
        request=MembershipCreateSerializer,
        responses={
            201: MembershipSerializer,
            400: OpenApiResponse(
                description="Validation error, or user is already a member."
            ),
        },
        parameters=[
            OpenApiParameter(
                name="userId",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description=(
                    "UUID of the user to invite (from auth_service). "
                    "Pass this value in the request body, not as a query param — "
                    "documented here for Swagger discoverability."
                ),
                required=False,
            ),
        ],
        tags=_MEMBERSHIP_TAG,
    ),
    destroy=extend_schema(
        summary="Remove a member from a project",
        description="Permanently deletes the Membership record identified by its UUID.",
        responses={204: None, 404: OpenApiResponse(description="Membership not found.")},
        tags=_MEMBERSHIP_TAG,
    ),
)
class MembershipViewSet(
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet for managing project memberships.

    Endpoints:
      POST   /api/memberships/                      → invite a member  (create)
      PATCH  /api/memberships/{id}/update-role/     → change their role (update_role)
      DELETE /api/memberships/{id}/                 → remove a member   (destroy)
    """

    permission_classes = [AllowAny]
    queryset = Membership.objects.select_related("projectId")

    def get_serializer_class(self):
        if self.action == "create":
            return MembershipCreateSerializer
        return MembershipSerializer

    def create(self, request: Request, *args, **kwargs) -> Response:
        """
        Invite a member — returns full MembershipSerializer on success.

        Uses MembershipCreateSerializer for input validation and
        MembershipSerializer for the 201 response payload.
        """
        write_serializer = MembershipCreateSerializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        membership = write_serializer.save()
        return Response(
            MembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )

    # ------------------------------------------------------------------
    # Custom action — UML: updateRole()
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Update a member's role",
        description=(
            "Changes the role of an existing membership. "
            "Accepted values: VIEWER | CONTRIBUTOR | MANAGER."
        ),
        request=MembershipUpdateRoleSerializer,
        responses={
            200: MembershipSerializer,
            400: OpenApiResponse(description="Invalid role value."),
            404: OpenApiResponse(description="Membership not found."),
        },
        tags=_MEMBERSHIP_TAG,
    )
    @action(detail=True, methods=["patch"], url_path="update-role")
    def update_role(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        """Change the role of a project member (UML: updateRole())."""
        membership = self.get_object()
        serializer = MembershipUpdateRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership.role = serializer.validated_data["role"]
        membership.save(update_fields=["role"])
        return Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)
