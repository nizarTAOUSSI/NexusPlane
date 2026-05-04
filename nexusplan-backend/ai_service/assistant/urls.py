"""
urls.py — URL routing for the assistant app.

Registered endpoints:
  POST /api/generate-tasks/   → AssistantViewSet.generate_tasks
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssistantViewSet

router = DefaultRouter()

# Prefix "" means the ViewSet actions sit directly under the mounted path.
# Combined with the main urls.py mount at "api/", this produces:
#   POST  /api/generate-tasks/
router.register(r"", AssistantViewSet, basename="assistant")

urlpatterns = [
    path("", include(router.urls)),
]
