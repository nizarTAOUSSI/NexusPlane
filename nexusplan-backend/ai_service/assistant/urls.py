"""
urls.py — URL routing for the assistant app.

All routes are mounted at /api/ai/ by the root urls.py, producing:

  POST  /api/ai/generate-tasks/  → AssistantViewSet.generate_tasks
  POST  /api/ai/summarize/       → AssistantViewSet.summarize
  POST  /api/ai/copilot/         → AssistantViewSet.copilot
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssistantViewSet

router = DefaultRouter()

# Prefix "" means the ViewSet actions sit directly under the mounted path.
# Combined with the main urls.py mount at "api/ai/", this produces:
#   POST  /api/ai/generate-tasks/
#   POST  /api/ai/summarize/
#   POST  /api/ai/copilot/
router.register(r"", AssistantViewSet, basename="assistant")

urlpatterns = [
    path("", include(router.urls)),
]
