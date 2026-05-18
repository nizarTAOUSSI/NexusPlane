"""URL configuration for project_service — NexusPlan"""

import os

from django.contrib import admin
from django.conf import settings as django_settings
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
import requests as http_requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from projects.models import Membership, Project


def _verify_internal_key(request) -> bool:
    expected = os.environ.get("INTERNAL_API_KEY", "").strip()
    incoming = request.headers.get("X-Internal-Key", "").strip()
    return bool(expected) and expected == incoming


def _lookup_users_by_ids(user_ids: list[str]) -> dict[str, dict]:
    unique_ids = [u for u in dict.fromkeys(user_ids) if u]
    if not unique_ids:
        return {}

    auth_url = getattr(django_settings, "AUTH_SERVICE_URL", "http://auth_service:8000").rstrip("/")
    endpoint = f"{auth_url}/api/auth/lookup-by-ids/"
    headers = {
        "Host": "localhost",
        "X-Internal-Key": os.environ.get("INTERNAL_API_KEY", "").strip(),
    }

    try:
        resp = http_requests.get(
            endpoint,
            params={"ids": ",".join(unique_ids)},
            headers=headers,
            timeout=8,
        )
    except Exception:
        return {}

    if resp.status_code != 200:
        return {}

    try:
        users = resp.json()
    except Exception:
        return {}

    out: dict[str, dict] = {}
    for u in users:
        uid = str(u.get("id") or "")
        if uid:
            out[uid] = u
    return out


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Simple liveness probe for the project service."""
    return Response({"status": "ok", "service": "project_service"})


@api_view(["GET"])
@permission_classes([AllowAny])
def internal_projects_with_members(request):
    """Internal endpoint: return all projects with nested member list."""
    if not _verify_internal_key(request):
        return Response({"detail": "Unauthorized"}, status=401)

    projects = Project.objects.all().order_by("-createdAt")
    memberships = Membership.objects.select_related("projectId").all()
    user_ids = [str(m.userId) for m in memberships]
    users_by_id = _lookup_users_by_ids(user_ids)

    by_project: dict[str, list[dict]] = {}
    for m in memberships:
        pid = str(m.projectId_id)
        by_project.setdefault(pid, []).append(
            {
                "id": str(m.id),
                "userId": str(m.userId),
                "role": m.role,
                "joinedAt": m.joinedAt.isoformat(),
                "user": users_by_id.get(str(m.userId), {
                    "id": str(m.userId),
                    "username": None,
                    "email": None,
                    "avatar": None,
                }),
            }
        )

    data = [
        {
            "id": str(p.id),
            "name": p.name,
            "description": p.description,
            "status": p.status,
            "ownerId": str(p.ownerId),
            "createdAt": p.createdAt.isoformat(),
            "updatedAt": p.updatedAt.isoformat(),
            "members": by_project.get(str(p.id), []),
        }
        for p in projects
    ]
    return Response(data)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/internal/projects-with-members/", internal_projects_with_members, name="internal-projects-with-members"),
    # Projects & Memberships
    path("api/", include("projects.urls")),
    # OpenAPI schema + Swagger UI + ReDoc
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

