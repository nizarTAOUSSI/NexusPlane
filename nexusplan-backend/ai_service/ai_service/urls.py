"""URL configuration for ai_service — NexusPlan"""

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

from assistant.models import AIRequestLog


INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "").strip()


def _verify_internal_key(request) -> bool:
    key = request.headers.get("X-Internal-Key", "").strip()
    return bool(key and key == INTERNAL_API_KEY)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Simple liveness probe for the AI service."""
    return Response({"status": "ok", "service": "ai_service"})


@api_view(["GET"])
@permission_classes([AllowAny])
def internal_ai_request_logs(request):
    """Internal-only endpoint: return recent AI request logs."""
    if not _verify_internal_key(request):
        return Response({"detail": "Unauthorized"}, status=401)

    limit_raw = request.query_params.get("limit", "500")
    try:
        limit = max(1, min(int(limit_raw), 5000))
    except ValueError:
        limit = 500

    logs = AIRequestLog.objects.all().order_by("-createdAt")[:limit]
    data = [
        {
            "id": str(log.id),
            "userId": str(log.userId),
            "projectId": str(log.projectId) if log.projectId else None,
            "promptType": log.promptType,
            "tokensUsed": log.tokensUsed,
            "createdAt": log.createdAt.isoformat(),
        }
        for log in logs
    ]
    return Response(data)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/internal/ai-request-logs/", internal_ai_request_logs, name="internal-ai-request-logs"),

    path("api/ai/", include("assistant.urls")),

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
