"""
views.py — AssistantViewSet

Custom ViewSet (not ModelViewSet) that exposes action-based endpoints.
Authentication is handled by the API Gateway: it injects X-User-Id into
every authenticated request, so this service trusts that header directly.
"""

import logging

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .models import AIRequestLog, PromptType
from .serializers import (
    GeneratedTaskSerializer,
    GenerateTasksInputSerializer,
    GenerateTasksOutputSerializer,
)
from .services.llm_service import generate_tasks_from_description

logger = logging.getLogger(__name__)

_AI_TAG = ["AI Assistant"]


def _get_requester_id(request: Request) -> str | None:
    """
    Extract the trusted user UUID injected by the API Gateway.
    Header: X-User-Id  (same convention used across all NexusPlan services).
    """
    return request.headers.get("X-User-Id")


class AssistantViewSet(viewsets.GenericViewSet):
    """
    Action-based ViewSet for AI-powered project management assistance.
    No default CRUD — every method is an explicit @action.
    """

    permission_classes = [AllowAny]  # Gateway handles auth; service trusts X-User-Id.

    # -----------------------------------------------------------------------
    # POST /api/generate-tasks/
    # -----------------------------------------------------------------------

    @extend_schema(
        summary="Generate tasks from a project description",
        description=(
            "Sends the project description to the configured LLM (Gemini by default) "
            "and returns a structured list of actionable tasks.\n\n"
            "**Authentication**: The API Gateway injects `X-User-Id` automatically. "
            "Calls made without passing through the gateway will be rejected with 401.\n\n"
            "**Frontend contract**: The returned tasks are *suggestions*. "
            "The frontend should display them for user review and then POST each "
            "accepted task to `task_service` (`POST /tasks/`)."
        ),
        request=GenerateTasksInputSerializer,
        responses={
            200: GenerateTasksOutputSerializer,
            400: OpenApiResponse(description="Validation error (input) or LLM returned malformed JSON."),
            401: OpenApiResponse(description="Missing X-User-Id header — request must go through the API Gateway."),
            502: OpenApiResponse(description="LLM provider error (API key missing, quota exceeded, etc.)."),
        },
        tags=_AI_TAG,
    )
    @action(detail=False, methods=["post"], url_path="generate-tasks")
    def generate_tasks(self, request: Request) -> Response:
        """
        Decompose a project description into actionable tasks using an LLM.

        Flow:
          1. Validate input (description + optional projectId).
          2. Resolve the requesting user from the X-User-Id gateway header.
          3. Call the LLM service.
          4. Persist an AIRequestLog for cost-tracking and audit.
          5. Return the task list to the frontend.
        """

        # --- 1. Validate input -------------------------------------------
        in_serializer = GenerateTasksInputSerializer(data=request.data)
        if not in_serializer.is_valid():
            return Response(in_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        description = in_serializer.validated_data["description"]
        project_id  = in_serializer.validated_data.get("projectId")

        # --- 2. Resolve user ---------------------------------------------
        user_id = _get_requester_id(request)
        if not user_id:
            return Response(
                {
                    "detail": (
                        "Missing X-User-Id header. "
                        "This endpoint must be called through the API Gateway."
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # --- 3. Call LLM --------------------------------------------------
        try:
            result = generate_tasks_from_description(description)
        except ValueError as exc:
            # Model returned malformed JSON
            logger.warning("LLM parse error for user=%s: %s", user_id, exc)
            return Response(
                {"detail": f"The AI model returned an invalid response: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except RuntimeError as exc:
            # Missing API key, SDK not installed, provider unreachable
            logger.error("LLM provider error for user=%s: %s", user_id, exc)
            return Response(
                {"detail": f"AI provider error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # --- 4. Persist audit log ----------------------------------------
        log = AIRequestLog.objects.create(
            userId     = user_id,
            projectId  = project_id,
            promptType = PromptType.TASK_GENERATION,
            tokensUsed = result.tokens_used,
        )

        logger.info(
            "AIRequestLog created | id=%s | user=%s | project=%s | tokens=%d | tasks=%d",
            log.id,
            user_id,
            project_id,
            result.tokens_used,
            len(result.tasks),
        )

        # --- 5. Serialize & return ----------------------------------------
        task_data = GeneratedTaskSerializer(
            [
                {
                    "title":       t.title,
                    "description": t.description,
                    "priority":    t.priority,
                }
                for t in result.tasks
            ],
            many=True,
        ).data

        out_serializer = GenerateTasksOutputSerializer(
            {
                "tasks":      task_data,
                "tokensUsed": result.tokens_used,
                "logId":      str(log.id),
            }
        )
        return Response(out_serializer.data, status=status.HTTP_200_OK)
