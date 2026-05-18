"""URL configuration for project_service — NexusPlan"""

import os

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from projects.models import Membership, Project


def _verify_internal_key(request) -> bool:
    expected = os.environ.get("INTERNAL_API_KEY", "").strip()
    incoming = request.headers.get("X-Internal-Key", "").strip()
    return bool(expected) and expected == incoming


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

    by_project: dict[str, list[dict]] = {}
    for m in memberships:
        pid = str(m.projectId_id)
        by_project.setdefault(pid, []).append(
            {
                "id": str(m.id),
                "userId": str(m.userId),
                "role": m.role,
                "joinedAt": m.joinedAt.isoformat(),
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

