import json
import urllib.parse

import redis as redis_client
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

from .models import Membership, MemberRole, Project, ProjectStatus, Team, TeamMembership, TeamMemberRole
from .serializers import (
    MembershipCreateSerializer,
    MembershipSerializer,
    MembershipUpdateRoleSerializer,
    ProjectSerializer,
    ProjectUpdateSerializer,
    TeamSerializer,
    TeamCreateSerializer,
    TeamMembershipSerializer,
)

_PROJECT_TAG = ["Projects"]
_MEMBERSHIP_TAG = ["Memberships"]


def _redis():
    return redis_client.Redis.from_url(
        django_settings.REDIS_URL, decode_responses=True
    )


def _get_user_by_email(email: str) -> dict | None:
    try:
        cached = _redis().get(f"user:email:{email.lower()}")
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    try:
        auth_url = getattr(django_settings, "AUTH_SERVICE_URL", "").rstrip("/")
        if auth_url:
            resp = http_requests.get(
                f"{auth_url}/api/auth/lookup/",
                params={"email": email},
                timeout=3,
            )
            if resp.status_code == 200:
                data = resp.json()
                try:
                    _redis().set(
                        f"user:email:{email.lower()}",
                        json.dumps(data),
                        ex=86400,
                    )
                    _redis().set(
                        f"user:id:{data.get('id')}",
                        json.dumps(data),
                        ex=86400,
                    )
                except Exception:
                    pass
                return data
    except Exception:
        pass
    return None


def _get_user_by_id(user_id: str) -> dict | None:
    """Resolve user info by UUID. Redis first, then auth_service fallback."""
    try:
        cached = _redis().get(f"user:id:{user_id}")
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    # Fallback: ask auth_service directly
    try:
        auth_url = getattr(django_settings, "AUTH_SERVICE_URL", "").rstrip("/")
        if auth_url:
            resp = http_requests.get(
                f"{auth_url}/api/auth/lookup-by-id/",
                params={"id": user_id},
                timeout=3,
            )
            if resp.status_code == 200:
                data = resp.json()
                try:
                    _redis().set(f"user:id:{user_id}", json.dumps(data), ex=86400)
                except Exception:
                    pass
                return data
    except Exception:
        pass
    return None


def _batch_get_users(user_ids: list[str]) -> dict[str, dict]:
    """
    Resolve multiple user IDs at once.
    First fills from Redis, then does ONE batch HTTP call for any missing IDs.
    Returns {user_id: user_info_dict}.
    """
    result: dict[str, dict] = {}
    missing: list[str] = []

    # 1. Redis pass
    try:
        r = _redis()
        for uid in user_ids:
            cached = r.get(f"user:id:{uid}")
            if cached:
                result[uid] = json.loads(cached)
            else:
                missing.append(uid)
    except Exception:
        missing = [uid for uid in user_ids if uid not in result]

    if not missing:
        return result

    # 2. Single batch HTTP call to auth_service for all missing IDs
    try:
        auth_url = getattr(django_settings, "AUTH_SERVICE_URL", "").rstrip("/")
        if auth_url:
            resp = http_requests.get(
                f"{auth_url}/api/auth/lookup-by-ids/",
                params={"ids": ",".join(missing)},
                timeout=5,
            )
            if resp.status_code == 200:
                fetched = resp.json()  # list of user dicts
                try:
                    r = _redis()
                    for u in fetched:
                        uid = str(u.get("id", ""))
                        if uid:
                            result[uid] = u
                            r.set(f"user:id:{uid}", json.dumps(u), ex=86400)
                except Exception:
                    for u in fetched:
                        uid = str(u.get("id", ""))
                        if uid:
                            result[uid] = u
    except Exception:
        pass

    return result


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



_TEAM_ROLE_COLOR = {
    "MEMBER": "#10B981",
    "ADMIN":  "#8B5CF6",
    "OWNER":  "#6366F1",
}


def _team_role_badge(role: str) -> str:
    color = _TEAM_ROLE_COLOR.get(role, "#10B981")
    return (
        f'<span style="display:inline-block;background:{color}20;color:{color};'
        f'border:1px solid {color}40;border-radius:999px;'
        f'padding:3px 14px;font-size:12px;font-weight:700;'
        f'text-transform:uppercase;letter-spacing:0.07em;">{role}</span>'
    )


def _send_team_existing_user_invite(
    *,
    to_email: str,
    username: str,
    team_name: str,
    role: str,
    team_url: str,
) -> None:
    """Send a team invitation email to an existing NexusPlan user."""
    from datetime import date

    subject = f"You've been added to the \"{team_name}\" team on NexusPlan"

    body = f"""
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;
                color:#10B981;text-transform:uppercase;letter-spacing:0.1em;">
        Team Invitation
      </p>
      <h1 style="margin:0 0 18px;font-size:26px;font-weight:800;
                 color:#FFFFFF;letter-spacing:-0.5px;line-height:1.2;">
        You&rsquo;ve joined a team!
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9090B0;line-height:1.7;">
        Hi <strong style="color:#FFFFFF;">{username}</strong>, you&rsquo;ve been added to a
        team on NexusPlan. Teams let you collaborate across multiple projects at once.
      </p>

      <!-- Team card -->
      <div style="background:#12121C;border:1px solid rgba(255,255,255,0.08);
                  border-radius:14px;padding:22px 24px;margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
          <div style="width:48px;height:48px;border-radius:14px;flex-shrink:0;
                      background:linear-gradient(135deg,#10B981,#06B6D4);
                      display:flex;align-items:center;justify-content:center;">
            <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-1px;">
              {team_name[:2].upper()}
            </span>
          </div>
          <div>
            <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#4B4B6B;
                      text-transform:uppercase;letter-spacing:0.09em;">Team</p>
            <p style="margin:0;font-size:20px;font-weight:800;color:#FFFFFF;
                      letter-spacing:-0.3px;">{team_name}</p>
          </div>
        </div>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#4B4B6B;
                  text-transform:uppercase;letter-spacing:0.09em;">Your Role</p>
        {_team_role_badge(role)}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="{team_url}"
           style="display:inline-block;background:linear-gradient(135deg,#10B981,#06B6D4);
                  color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;
                  padding:14px 36px;border-radius:12px;
                  box-shadow:0 8px 24px rgba(16,185,129,0.35);
                  letter-spacing:0.01em;">
          View Team &rarr;
        </a>
      </div>

      <p style="margin:0;font-size:13px;color:#4B4B6B;text-align:center;line-height:1.6;">
        Or copy this link:<br/>
        <a href="{team_url}" style="color:#10B981;font-size:12px;word-break:break-all;">
          {team_url}
        </a>
      </p>
    """

    html_content = _BASE_HTML.format(subject=subject, body=body, year=date.today().year)
    text_content = (
        f"Hi {username},\n\n"
        f"You've been added to the \"{team_name}\" team on NexusPlan with role: {role}.\n\n"
        f"View the team here: {team_url}\n\n"
        f"\u2014 The NexusPlan Team"
    )
    msg = EmailMultiAlternatives(subject=subject, body=text_content, to=[to_email])
    msg.attach_alternative(html_content, "text/html")
    msg.send(fail_silently=True)


def _send_team_new_user_invite(
    *,
    to_email: str,
    team_name: str,
    role: str,
    register_url: str,
) -> None:
    """Send a team invitation to someone who doesn't have a NexusPlan account yet."""
    from datetime import date

    subject = f"You're invited to join the \"{team_name}\" team on NexusPlan"

    body = f"""
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;
                color:#06B6D4;text-transform:uppercase;letter-spacing:0.1em;">
        Team Invitation
      </p>
      <h1 style="margin:0 0 18px;font-size:26px;font-weight:800;
                 color:#FFFFFF;letter-spacing:-0.5px;line-height:1.2;">
        You&rsquo;re invited to collaborate
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9090B0;line-height:1.7;">
        Someone has invited you to join a team on
        <strong style="color:#FFFFFF;">NexusPlan</strong> &mdash;
        the modern collaborative project management platform.
        Create your free account to get started.
      </p>

      <!-- Team card -->
      <div style="background:#12121C;border:1px solid rgba(255,255,255,0.08);
                  border-radius:14px;padding:22px 24px;margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
          <div style="width:48px;height:48px;border-radius:14px;flex-shrink:0;
                      background:linear-gradient(135deg,#06B6D4,#8B5CF6);
                      display:flex;align-items:center;justify-content:center;">
            <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-1px;">
              {team_name[:2].upper()}
            </span>
          </div>
          <div>
            <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#4B4B6B;
                      text-transform:uppercase;letter-spacing:0.09em;">You&rsquo;re invited to</p>
            <p style="margin:0;font-size:20px;font-weight:800;color:#FFFFFF;
                      letter-spacing:-0.3px;">{team_name}</p>
          </div>
        </div>
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#4B4B6B;
                  text-transform:uppercase;letter-spacing:0.09em;">Your Role</p>
        {_team_role_badge(role)}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="{register_url}"
           style="display:inline-block;background:linear-gradient(135deg,#06B6D4,#8B5CF6);
                  color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;
                  padding:14px 36px;border-radius:12px;
                  box-shadow:0 8px 24px rgba(6,182,212,0.35);
                  letter-spacing:0.01em;">
          Create Account &amp; Join &rarr;
        </a>
      </div>

      <p style="margin:0;font-size:13px;color:#4B4B6B;text-align:center;line-height:1.6;">
        Or copy this link:<br/>
        <a href="{register_url}" style="color:#06B6D4;font-size:12px;word-break:break-all;">
          {register_url}
        </a>
      </p>
    """

    html_content = _BASE_HTML.format(subject=subject, body=body, year=date.today().year)
    text_content = (
        f"You've been invited to join the \"{team_name}\" team on NexusPlan "
        f"with role: {role}.\n\n"
        f"Create your free account here: {register_url}\n\n"
        f"\u2014 The NexusPlan Team"
    )
    msg = EmailMultiAlternatives(subject=subject, body=text_content, to=[to_email])
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
        """
        Return non-deleted projects.

        Supports two filter modes:
          - ``userId``  → returns projects where the user is owner OR member
          - ``ownerId`` → returns only projects owned by that user (legacy)
        ``status`` can be combined with either.
        """
        from django.db.models import Q
        qs = Project.objects.exclude(status=ProjectStatus.DELETED)

        user_id      = self.request.query_params.get("userId")
        owner_id     = self.request.query_params.get("ownerId")
        filter_status = self.request.query_params.get("status")

        if user_id:
            member_project_ids = Membership.objects.filter(
                userId=user_id
            ).values_list("projectId_id", flat=True)
            qs = qs.filter(
                Q(ownerId=user_id) | Q(id__in=member_project_ids)
            )
        elif owner_id:
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
        requester_id = request.headers.get("X-User-Id")
        if str(project.ownerId) != requester_id:
            return Response(
                {"detail": "Only the project owner can delete this project."},
                status=status.HTTP_403_FORBIDDEN,
            )
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
            "Only the project owner can archive. "
            "Returns 409 if the project is already ARCHIVED or DELETED."
        ),
        request=None,
        responses={
            200: ProjectSerializer,
            403: OpenApiResponse(description="Caller is not the project owner."),
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
        requester_id = request.headers.get("X-User-Id")
        if str(project.ownerId) != requester_id:
            return Response(
                {"detail": "Only the project owner can archive this project."},
                status=status.HTTP_403_FORBIDDEN,
            )
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
        """Return all memberships enriched with username/email from Redis.
        The project owner is always prepended as the first entry with role OWNER.
        """
        project = self.get_object()
        memberships = project.memberships.all()

        # Collect all user IDs, then batch-resolve in one shot
        all_ids = [str(project.ownerId)] + [str(m.userId) for m in memberships]
        user_map = _batch_get_users(all_ids)

        enriched = []
        owner_info = user_map.get(str(project.ownerId), {})
        enriched.append({
            "id":        f"owner-{project.ownerId}",
            "projectId": str(project.id),
            "userId":    str(project.ownerId),
            "username":  owner_info.get("username") or None,
            "email":     owner_info.get("email") or None,
            "avatar":    owner_info.get("avatar") or None,
            "role":      "OWNER",
            "joinedAt":  project.createdAt.isoformat(),
        })

        for m in memberships:
            user_info = user_map.get(str(m.userId), {})
            enriched.append({
                "id":        str(m.id),
                "projectId": str(m.projectId_id),
                "userId":    str(m.userId),
                "username":  user_info.get("username") or None,
                "email":     user_info.get("email") or None,
                "avatar":    user_info.get("avatar") or None,
                "role":      m.role,
                "joinedAt":  m.joinedAt.isoformat(),
            })

        return Response(enriched, status=status.HTTP_200_OK)

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
        requester_id = request.headers.get("X-User-Id")
        # Only project owner or MANAGERs may invite
        is_owner = str(project.ownerId) == requester_id
        is_manager = Membership.objects.filter(
            projectId=project, userId=requester_id, role="MANAGER"
        ).exists()
        if not (is_owner or is_manager):
            return Response(
                {"detail": "Only the project owner or managers can invite members."},
                status=status.HTTP_403_FORBIDDEN,
            )
        email = (request.data.get("email") or "").strip().lower()
        role = (request.data.get("role") or "VIEWER").strip().upper()

        if not email:
            return Response(
                {"detail": "'email' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_info  = _get_user_by_email(email)
        user_exists = user_info is not None
        user_id     = user_info.get("id") if user_exists else None
        username    = (user_info.get("username") or email.split("@")[0]) if user_exists else email.split("@")[0]

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


    # ------------------------------------------------------------------
    # quit — let a member leave the project voluntarily
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Quit a project",
        description=(
            "Allows the authenticated user to leave a project they are a member of. "
            "The project owner cannot quit — they must transfer ownership or delete the project."
        ),
        request=None,
        responses={
            204: OpenApiResponse(description="Successfully left the project."),
            400: OpenApiResponse(description="Owner cannot quit their own project."),
            404: OpenApiResponse(description="You are not a member of this project."),
        },
        tags=_PROJECT_TAG,
    )
    @action(detail=True, methods=["post"], url_path="quit")
    def quit(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        """Remove the caller from the project's membership list."""
        project = self.get_object()
        requester_id = request.headers.get("X-User-Id")
        if str(project.ownerId) == requester_id:
            return Response(
                {"detail": "The project owner cannot quit. Transfer ownership or delete the project."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            membership = Membership.objects.get(projectId=project, userId=requester_id)
        except Membership.DoesNotExist:
            return Response(
                {"detail": "You are not a member of this project."},
                status=status.HTTP_404_NOT_FOUND,
            )
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # kick — let owner remove any member
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Remove a member from a project (kick)",
        description=(
            "Allows the project owner to remove any member. "
            "Managers can also remove VIEWER and CONTRIBUTOR members."
        ),
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "userId": {"type": "string", "format": "uuid"},
                },
                "required": ["userId"],
            }
        },
        responses={
            204: OpenApiResponse(description="Member removed."),
            403: OpenApiResponse(description="Insufficient permissions."),
            404: OpenApiResponse(description="Member not found."),
        },
        tags=_PROJECT_TAG,
    )
    @action(detail=True, methods=["post"], url_path="kick")
    def kick(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        """Remove a member from the project (owner/manager action)."""
        project = self.get_object()
        requester_id = request.headers.get("X-User-Id")
        target_user_id = (request.data.get("userId") or "").strip()

        if not target_user_id:
            return Response(
                {"detail": "'userId' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_owner = str(project.ownerId) == requester_id
        requester_membership = Membership.objects.filter(
            projectId=project, userId=requester_id
        ).first()
        is_manager = requester_membership and requester_membership.role == "MANAGER"

        if not (is_owner or is_manager):
            return Response(
                {"detail": "Only the project owner or managers can remove members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Cannot kick the owner
        if str(project.ownerId) == target_user_id:
            return Response(
                {"detail": "The project owner cannot be removed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            membership = Membership.objects.get(projectId=project, userId=target_user_id)
        except Membership.DoesNotExist:
            return Response(
                {"detail": "This user is not a member of the project."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Managers can only remove viewers/contributors (not other managers)
        if is_manager and not is_owner and membership.role == "MANAGER":
            return Response(
                {"detail": "Managers cannot remove other managers. Only the owner can."},
                status=status.HTTP_403_FORBIDDEN,
            )

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        requester_id = request.headers.get("X-User-Id")
        project = membership.projectId
        is_owner = str(project.ownerId) == requester_id
        is_manager = Membership.objects.filter(
            projectId=project, userId=requester_id, role="MANAGER"
        ).exists()
        if not (is_owner or is_manager):
            return Response(
                {"detail": "Only the project owner or managers can update member roles."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = MembershipUpdateRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership.role = serializer.validated_data["role"]
        membership.save(update_fields=["role"])
        return Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# TeamViewSet
# ---------------------------------------------------------------------------

_TEAM_TAG = ["Teams"]


@extend_schema_view(
    list=extend_schema(
        summary="List teams visible to the caller",
        description=(
            "Returns all teams owned by the caller OR where the caller is a member. "
            "Pass ``userId`` to filter by a specific user."
        ),
        parameters=[
            OpenApiParameter(
                name="userId",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter teams that belong to this user (owner or member).",
            ),
        ],
        tags=_TEAM_TAG,
    ),
    create=extend_schema(
        summary="Create a new team",
        request=TeamCreateSerializer,
        responses={201: TeamSerializer},
        tags=_TEAM_TAG,
    ),
    retrieve=extend_schema(
        summary="Get a team",
        responses={200: TeamSerializer},
        tags=_TEAM_TAG,
    ),
    update=extend_schema(
        summary="Update a team (full)",
        request=TeamCreateSerializer,
        responses={200: TeamSerializer},
        tags=_TEAM_TAG,
    ),
    partial_update=extend_schema(
        summary="Update a team (partial)",
        request=TeamCreateSerializer,
        responses={200: TeamSerializer},
        tags=_TEAM_TAG,
    ),
    destroy=extend_schema(
        summary="Delete a team",
        responses={204: None},
        tags=_TEAM_TAG,
    ),
)
class TeamViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Team resources.

    A Team is an independent group of users. Teams can be invited to projects
    in bulk via the ``invite-to-project`` action.
    """

    permission_classes = [AllowAny]
    serializer_class = TeamSerializer

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return TeamCreateSerializer
        return TeamSerializer

    def get_queryset(self):
        from django.db.models import Q
        user_id = self.request.query_params.get("userId") or self.request.headers.get("X-User-Id")
        if user_id:
            member_team_ids = TeamMembership.objects.filter(
                userId=user_id
            ).values_list("team_id", flat=True)
            return Team.objects.filter(
                Q(ownerId=user_id) | Q(id__in=member_team_ids)
            )
        return Team.objects.all()

    def create(self, request: Request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(TeamSerializer(serializer.instance).data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        owner_id = self.request.headers.get("X-User-Id")
        if not owner_id:
            raise ValidationError({"ownerId": "Missing X-User-Id header."})
        team = serializer.save(ownerId=owner_id)
        TeamMembership.objects.create(team=team, userId=owner_id, role=TeamMemberRole.ADMIN)

    def update(self, request: Request, *args, **kwargs) -> Response:
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        requester_id = request.headers.get("X-User-Id")
        if str(instance.ownerId) != requester_id:
            return Response(
                {"detail": "Only the team owner can update this team."},
                status=status.HTTP_403_FORBIDDEN,
            )
        write_serializer = TeamCreateSerializer(instance, data=request.data, partial=partial)
        write_serializer.is_valid(raise_exception=True)
        team = write_serializer.save()
        return Response(TeamSerializer(team).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        instance = self.get_object()
        requester_id = request.headers.get("X-User-Id")
        if str(instance.ownerId) != requester_id:
            return Response(
                {"detail": "Only the team owner can delete this team."},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Get team members — enriched with username/email from Redis
    # ------------------------------------------------------------------

    @extend_schema(
        summary="List team members",
        responses={200: TeamMembershipSerializer(many=True)},
        tags=_TEAM_TAG,
    )
    @action(detail=True, methods=["get"], url_path="members")
    def get_members(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        team = self.get_object()
        memberships = team.memberships.all()

        # Collect all user IDs, then batch-resolve in one shot
        all_ids = [str(team.ownerId)] + [str(m.userId) for m in memberships]
        user_map = _batch_get_users(all_ids)

        enriched = []
        owner_info = user_map.get(str(team.ownerId), {})
        enriched.append({
            "id":       f"owner-{team.ownerId}",
            "teamId":   str(team.id),
            "userId":   str(team.ownerId),
            "username": owner_info.get("username") or None,
            "email":    owner_info.get("email") or None,
            "avatar":   owner_info.get("avatar") or None,
            "role":     "OWNER",
            "joinedAt": team.createdAt.isoformat(),
        })

        for m in memberships:
            if str(m.userId) == str(team.ownerId):
                continue  # already included above
            user_info = user_map.get(str(m.userId), {})
            enriched.append({
                "id":       str(m.id),
                "teamId":   str(team.id),
                "userId":   str(m.userId),
                "username": user_info.get("username") or None,
                "email":    user_info.get("email") or None,
                "avatar":   user_info.get("avatar") or None,
                "role":     m.role,
                "joinedAt": m.joinedAt.isoformat(),
            })

        return Response(enriched, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # Invite member by email
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Invite a user to the team by email",
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "email": {"type": "string", "format": "email"},
                    "role": {"type": "string", "enum": ["MEMBER", "ADMIN"], "default": "MEMBER"},
                },
                "required": ["email"],
            }
        },
        responses={
            201: TeamMembershipSerializer,
            202: OpenApiResponse(description="No account found — registration invite sent."),
            400: OpenApiResponse(description="Already a member."),
            403: OpenApiResponse(description="Insufficient permissions."),
        },
        tags=_TEAM_TAG,
    )
    @action(detail=True, methods=["post"], url_path="invite")
    def invite(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        team = self.get_object()
        requester_id = request.headers.get("X-User-Id")

        # Only owner or ADMIN members can invite
        is_owner = str(team.ownerId) == requester_id
        is_admin = TeamMembership.objects.filter(
            team=team, userId=requester_id, role=TeamMemberRole.ADMIN
        ).exists()
        if not (is_owner or is_admin):
            return Response(
                {"detail": "Only the team owner or admins can invite members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        email = (request.data.get("email") or "").strip().lower()
        role  = (request.data.get("role") or "MEMBER").strip().upper()
        if not email:
            return Response({"detail": "'email' is required."}, status=status.HTTP_400_BAD_REQUEST)

        user_info  = _get_user_by_email(email)
        user_exists = user_info is not None
        user_id     = user_info.get("id") if user_exists else None

        frontend_url = django_settings.FRONTEND_URL.rstrip("/")

        if user_exists:
            if TeamMembership.objects.filter(team=team, userId=user_id).exists():
                return Response(
                    {"detail": "This user is already a member of the team."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            membership = TeamMembership.objects.create(team=team, userId=user_id, role=role)
            username = user_info.get("username") or email.split("@")[0]
            _send_team_existing_user_invite(
                to_email=email,
                username=username,
                team_name=team.name,
                role=role,
                team_url=f"{frontend_url}/teams",
            )
            return Response(
                {
                    "id":       str(membership.id),
                    "teamId":   str(team.id),
                    "userId":   str(membership.userId),
                    "role":     membership.role,
                    "joinedAt": membership.joinedAt.isoformat(),
                },
                status=status.HTTP_201_CREATED,
            )
        else:
            register_url = (
                f"{frontend_url}/signup"
                f"?invite_team={team.id}"
                f"&invite_role={role}"
                f"&email={urllib.parse.quote(email)}"
            )
            _send_team_new_user_invite(
                to_email=email,
                team_name=team.name,
                role=role,
                register_url=register_url,
            )
            return Response(
                {"detail": "No account found. A registration invitation has been sent."},
                status=status.HTTP_202_ACCEPTED,
            )

    # ------------------------------------------------------------------
    # Quit team (member leaves voluntarily)
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Quit a team",
        description="Allows the authenticated user to leave a team. The team owner cannot quit.",
        responses={
            204: OpenApiResponse(description="Successfully left the team."),
            400: OpenApiResponse(description="Owner cannot quit."),
            404: OpenApiResponse(description="Not a member."),
        },
        tags=_TEAM_TAG,
    )
    @action(detail=True, methods=["post"], url_path="quit")
    def quit(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        team = self.get_object()
        requester_id = request.headers.get("X-User-Id")
        if str(team.ownerId) == requester_id:
            return Response(
                {"detail": "The team owner cannot quit. Transfer ownership or delete the team."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            membership = TeamMembership.objects.get(team=team, userId=requester_id)
        except TeamMembership.DoesNotExist:
            return Response(
                {"detail": "You are not a member of this team."},
                status=status.HTTP_404_NOT_FOUND,
            )
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Kick a member (owner / admin only)
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Remove a member from the team",
        request={
            "application/json": {
                "type": "object",
                "properties": {"userId": {"type": "string", "format": "uuid"}},
                "required": ["userId"],
            }
        },
        responses={
            204: OpenApiResponse(description="Member removed."),
            403: OpenApiResponse(description="Insufficient permissions."),
            404: OpenApiResponse(description="Member not found."),
        },
        tags=_TEAM_TAG,
    )
    @action(detail=True, methods=["post"], url_path="kick")
    def kick(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        team = self.get_object()
        requester_id  = request.headers.get("X-User-Id")
        target_user_id = (request.data.get("userId") or "").strip()

        if not target_user_id:
            return Response({"detail": "'userId' is required."}, status=status.HTTP_400_BAD_REQUEST)

        is_owner = str(team.ownerId) == requester_id
        requester_tm = TeamMembership.objects.filter(team=team, userId=requester_id).first()
        is_admin  = requester_tm and requester_tm.role == TeamMemberRole.ADMIN

        if not (is_owner or is_admin):
            return Response(
                {"detail": "Only the team owner or admins can remove members."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if str(team.ownerId) == target_user_id:
            return Response(
                {"detail": "The team owner cannot be removed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            membership = TeamMembership.objects.get(team=team, userId=target_user_id)
        except TeamMembership.DoesNotExist:
            return Response(
                {"detail": "This user is not a member of the team."},
                status=status.HTTP_404_NOT_FOUND,
            )
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Invite the entire team to a project (bulk invite)
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Invite the entire team to a project",
        description=(
            "Adds every member of the team to the specified project (with a given role). "
            "Members already in the project are silently skipped. "
            "The caller must be the project owner or a project MANAGER."
        ),
        request={
            "application/json": {
                "type": "object",
                "properties": {
                    "projectId": {"type": "string", "format": "uuid"},
                    "role": {
                        "type": "string",
                        "enum": ["VIEWER", "CONTRIBUTOR", "MANAGER"],
                        "default": "CONTRIBUTOR",
                    },
                },
                "required": ["projectId"],
            }
        },
        responses={
            200: OpenApiResponse(description="Summary of how many members were added."),
            403: OpenApiResponse(description="Insufficient permissions."),
            404: OpenApiResponse(description="Project not found."),
        },
        tags=_TEAM_TAG,
    )
    @action(detail=True, methods=["post"], url_path="invite-to-project")
    def invite_to_project(self, request: Request, pk=None) -> Response:  # noqa: ARG002
        """Batch-invite all team members to a project."""
        team = self.get_object()
        requester_id = request.headers.get("X-User-Id")
        project_id   = (request.data.get("projectId") or "").strip()
        role         = (request.data.get("role") or "CONTRIBUTOR").strip().upper()

        if not project_id:
            return Response({"detail": "'projectId' is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check caller is project owner or manager
        is_proj_owner   = str(project.ownerId) == requester_id
        is_proj_manager = Membership.objects.filter(
            projectId=project, userId=requester_id, role="MANAGER"
        ).exists()
        if not (is_proj_owner or is_proj_manager):
            return Response(
                {"detail": "Only the project owner or managers can invite teams to a project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Collect all team user IDs (owner + members)
        team_user_ids = set()
        team_user_ids.add(str(team.ownerId))
        for tm in team.memberships.all():
            team_user_ids.add(str(tm.userId))

        # Existing project members — skip them
        existing_member_ids = set(
            str(uid) for uid in
            Membership.objects.filter(projectId=project).values_list("userId", flat=True)
        )
        existing_member_ids.add(str(project.ownerId))  # project owner is implicitly a member

        added    = 0
        skipped  = 0
        memberships_created = []

        for uid in team_user_ids:
            if uid in existing_member_ids:
                skipped += 1
                continue
            m = Membership.objects.create(projectId=project, userId=uid, role=role)
            memberships_created.append(m)
            added += 1

            # Send invitation email (best-effort)
            user_info = _get_user_by_id(uid) or {}
            email     = user_info.get("email")
            username  = user_info.get("username") or (email.split("@")[0] if email else uid[:8])
            frontend_url = django_settings.FRONTEND_URL.rstrip("/")
            if email:
                try:
                    _send_existing_user_invite(
                        to_email=email,
                        username=username,
                        project_name=project.name,
                        role=role,
                        project_url=f"{frontend_url}/projects/{project.id}",
                        frontend_url=frontend_url,
                    )
                except Exception:
                    pass

        return Response(
            {
                "added":   added,
                "skipped": skipped,
                "teamId":  str(team.id),
                "projectId": str(project.id),
                "role":    role,
            },
            status=status.HTTP_200_OK,
        )

