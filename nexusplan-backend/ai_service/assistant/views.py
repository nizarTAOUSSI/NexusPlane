"""
views.py — AssistantViewSet

Custom ViewSet (not ModelViewSet) that exposes action-based endpoints.
Authentication is handled by the API Gateway: it injects X-User-Id into
every authenticated request, so this service trusts that header directly.

Endpoints
─────────
POST /api/ai/generate-tasks/   → AssistantViewSet.generate_tasks
POST /api/ai/summarize/        → AssistantViewSet.summarize
POST /api/ai/copilot/          → AssistantViewSet.copilot
"""

import logging

from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .models import AIRequestLog, PromptType
from .serializers import (
    # task generation
    GeneratedTaskSerializer,
    GenerateTasksInputSerializer,
    GenerateTasksOutputSerializer,
    # project summary
    SummarizeProjectInputSerializer,
    SummarizeProjectOutputSerializer,
    # copilot
    CopilotInputSerializer,
    CopilotOutputSerializer,
)
from .services.llm_service import (
    copilot_chat,
    generate_tasks_from_description,
    summarize_project_data,
)

logger = logging.getLogger(__name__)

_AI_TAG = ["AI Assistant"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_requester_id(request: Request) -> str | None:
    """
    Extract the trusted user UUID injected by the API Gateway.
    Header: X-User-Id  (same convention used across all NexusPlan services).
    """
    return request.headers.get("X-User-Id")


def _require_user_id(request: Request) -> tuple[str | None, Response | None]:
    """
    Return (user_id, None) on success or (None, 401 Response) when the
    X-User-Id gateway header is absent.
    """
    user_id = _get_requester_id(request)
    if not user_id:
        return None, Response(
            {
                "detail": (
                    "Missing X-User-Id header. "
                    "This endpoint must be called through the API Gateway."
                )
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return user_id, None


# ---------------------------------------------------------------------------
# ViewSet
# ---------------------------------------------------------------------------

class AssistantViewSet(viewsets.GenericViewSet):
    """
    Action-based ViewSet for AI-powered project management assistance.
    No default CRUD — every method is an explicit @action.
    """

    permission_classes = [AllowAny]  # Gateway handles auth; service trusts X-User-Id.

    # =========================================================================
    # POST /api/ai/generate-tasks/
    # =========================================================================

    @extend_schema(
        summary="Generate tasks from a project description",
        description=(
            "Sends the project description to the configured LLM (Gemini → Grok → OpenRouter "
            "fallback chain) and returns a structured list of actionable tasks.\n\n"
            "**Authentication**: The API Gateway injects `X-User-Id` automatically. "
            "Calls made without passing through the gateway will be rejected with 401.\n\n"
            "**Frontend contract**: The returned tasks are *suggestions*. "
            "The frontend should display them for user review and then POST each "
            "accepted task to `task_service` (`POST /tasks/`)."
        ),
        request=GenerateTasksInputSerializer,
        responses={
            200: GenerateTasksOutputSerializer,
            400: OpenApiResponse(description="Validation error or LLM returned malformed JSON."),
            401: OpenApiResponse(description="Missing X-User-Id header — request must go through the API Gateway."),
            502: OpenApiResponse(description="All LLM providers failed (API key missing, quota exceeded, etc.)."),
        },
        examples=[
            OpenApiExample(
                "Request example",
                value={"description": "Build a user authentication system with JWT and refresh tokens.", "projectId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"},
                request_only=True,
            ),
            OpenApiExample(
                "Success response",
                value={
                    "tasks": [
                        {"title": "Design JWT token schema", "description": "Define the payload structure for access and refresh tokens.", "priority": "HIGH"},
                        {"title": "Implement login endpoint", "description": "Build POST /auth/login that validates credentials and issues tokens.", "priority": "HIGH"},
                    ],
                    "tokensUsed": 412,
                    "modelUsed": "gemini/gemini-2.0-flash",
                    "logId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                },
                response_only=True,
            ),
        ],
        tags=_AI_TAG,
    )
    @action(detail=False, methods=["post"], url_path="generate-tasks")
    def generate_tasks(self, request: Request) -> Response:
        """
        Decompose a project description into actionable tasks using an LLM.

        Flow:
          1. Validate input (description + optional projectId).
          2. Resolve the requesting user from the X-User-Id gateway header.
          3. Call the LLM service (Gemini → Grok → OpenRouter fallback).
          4. Persist an AIRequestLog for cost-tracking and audit.
          5. Return the task list to the frontend.
        """

        # ── 1. Validate input ──────────────────────────────────────────────
        in_serializer = GenerateTasksInputSerializer(data=request.data)
        if not in_serializer.is_valid():
            return Response(in_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        description = in_serializer.validated_data["description"]
        project_id  = in_serializer.validated_data.get("projectId")

        # ── 2. Resolve user ────────────────────────────────────────────────
        user_id, err = _require_user_id(request)
        if err:
            return err

        # ── 3. Call LLM ────────────────────────────────────────────────────
        try:
            result = generate_tasks_from_description(description)
        except ValueError as exc:
            logger.warning("LLM parse error for user=%s: %s", user_id, exc)
            return Response(
                {"detail": f"The AI model returned an invalid response: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except RuntimeError as exc:
            logger.error("LLM provider error for user=%s: %s", user_id, exc)
            return Response(
                {"detail": f"AI provider error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ── 4. Persist audit log ───────────────────────────────────────────
        log = AIRequestLog.objects.create(
            userId     = user_id,
            projectId  = project_id,
            promptType = PromptType.TASK_GENERATION,
            tokensUsed = result.tokens_used,
        )
        logger.info(
            "AIRequestLog created | id=%s | user=%s | project=%s | tokens=%d | tasks=%d",
            log.id, user_id, project_id, result.tokens_used, len(result.tasks),
        )

        # ── 5. Serialize & return ──────────────────────────────────────────
        task_data = GeneratedTaskSerializer(
            [{"title": t.title, "description": t.description, "priority": t.priority}
             for t in result.tasks],
            many=True,
        ).data

        out = GenerateTasksOutputSerializer({
            "tasks":      task_data,
            "tokensUsed": result.tokens_used,
            "modelUsed":  result.model_used,
            "logId":      str(log.id),
        })
        return Response(out.data, status=status.HTTP_200_OK)

    # =========================================================================
    # POST /api/ai/summarize/
    # =========================================================================

    @extend_schema(
        summary="Summarize project progress",
        description=(
            "Accepts a project name and an array of task objects, then returns a "
            "high-level **executive prose summary** of the project's current health, "
            "progress highlights, risks/blockers, and recommended next focus area.\n\n"
            "**Authentication**: The API Gateway injects `X-User-Id` automatically.\n\n"
            "**Tip**: Pass as many task fields as available (`status`, `priority`, "
            "`title`, `description`, `dueDate`) for a richer summary. "
            "The endpoint still works with minimal data."
        ),
        request=SummarizeProjectInputSerializer,
        responses={
            200: SummarizeProjectOutputSerializer,
            400: OpenApiResponse(description="Validation error in request body."),
            401: OpenApiResponse(description="Missing X-User-Id header — must go through the API Gateway."),
            502: OpenApiResponse(description="All LLM providers failed."),
        },
        examples=[
            OpenApiExample(
                "Request example",
                value={
                    "projectId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                    "projectName": "NexusPlan Auth System",
                    "tasks": [
                        {"title": "Design JWT schema",       "status": "DONE",        "priority": "HIGH"},
                        {"title": "Implement login endpoint", "status": "IN_PROGRESS", "priority": "HIGH"},
                        {"title": "Write auth unit tests",   "status": "TODO",        "priority": "MEDIUM"},
                        {"title": "Draft API docs",          "status": "TODO",        "priority": "LOW"},
                    ],
                },
                request_only=True,
            ),
            OpenApiExample(
                "Success response",
                value={
                    "summary": (
                        "The NexusPlan Auth System project is progressing steadily. "
                        "One of four tasks has been completed, with the critical login endpoint "
                        "currently in active development. Two tasks remain in the backlog. "
                        "The primary risk is the incomplete login implementation blocking "
                        "downstream testing. The recommended next step is to prioritise "
                        "completing the login endpoint before moving to test coverage."
                    ),
                    "tokensUsed": 389,
                    "modelUsed": "gemini/gemini-2.0-flash",
                    "logId": "7cb85f64-1234-4562-b3fc-2c963f66afa6",
                },
                response_only=True,
            ),
        ],
        tags=_AI_TAG,
    )
    @action(detail=False, methods=["post"], url_path="summarize")
    def summarize(self, request: Request) -> Response:
        """
        Generate an executive summary of a project's progress.

        Flow:
          1. Validate input (projectId, optional projectName & tasks array).
          2. Resolve the requesting user from the X-User-Id gateway header.
          3. Call summarize_project_data (Gemini → Grok → OpenRouter fallback).
          4. Persist an AIRequestLog for cost-tracking and audit.
          5. Return the prose summary to the frontend.
        """

        # ── 1. Validate input ──────────────────────────────────────────────
        in_serializer = SummarizeProjectInputSerializer(data=request.data)
        if not in_serializer.is_valid():
            return Response(in_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        project_id   = in_serializer.validated_data["projectId"]
        project_name = in_serializer.validated_data.get("projectName", "Unnamed Project")
        tasks        = in_serializer.validated_data.get("tasks", [])

        # ── 2. Resolve user ────────────────────────────────────────────────
        user_id, err = _require_user_id(request)
        if err:
            return err

        # ── 3. Call LLM ────────────────────────────────────────────────────
        try:
            result = summarize_project_data(
                project_name=project_name,
                tasks_data=[dict(t) for t in tasks],
            )
        except RuntimeError as exc:
            logger.error(
                "summarize_project_data failed | user=%s | project=%s | error=%s",
                user_id, project_id, exc,
            )
            return Response(
                {"detail": f"AI provider error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ── 4. Persist audit log ───────────────────────────────────────────
        log = AIRequestLog.objects.create(
            userId     = user_id,
            projectId  = project_id,
            promptType = PromptType.PROJECT_SUMMARY,
            tokensUsed = result.tokens_used,
        )
        logger.info(
            "AIRequestLog created | id=%s | user=%s | project=%s | tokens=%d | type=PROJECT_SUMMARY",
            log.id, user_id, project_id, result.tokens_used,
        )

        # ── 5. Serialize & return ──────────────────────────────────────────
        out = SummarizeProjectOutputSerializer({
            "summary":    result.text,
            "tokensUsed": result.tokens_used,
            "modelUsed":  result.model_used,
            "logId":      str(log.id),
        })
        return Response(out.data, status=status.HTTP_200_OK)

    # =========================================================================
    # POST /api/ai/copilot/
    # =========================================================================

    @extend_schema(
        summary="NexusPlan Copilot — conversational project assistant",
        description=(
            "Send a free-text question or request to the NexusPlan Copilot and receive "
            "intelligent, context-aware advice about your project or tasks.\n\n"
            "**Use cases**: Ask for task prioritisation advice, risk identification, "
            "sprint planning suggestions, blockers analysis, or any project management question.\n\n"
            "**Authentication**: The API Gateway injects `X-User-Id` automatically.\n\n"
            "**Context enrichment**: Optionally pass a `context` object containing "
            "`projectName`, `projectId`, `task` (current task detail dict), or "
            "`recentTasks` (array of recent task dicts) to ground the copilot's response "
            "in your actual project data."
        ),
        request=CopilotInputSerializer,
        responses={
            200: CopilotOutputSerializer,
            400: OpenApiResponse(description="Validation error — message too short/long."),
            401: OpenApiResponse(description="Missing X-User-Id header — must go through the API Gateway."),
            502: OpenApiResponse(description="All LLM providers failed."),
        },
        examples=[
            OpenApiExample(
                "Request — task-focused question",
                value={
                    "message": "This task has been in IN_PROGRESS for 3 days. What should I do?",
                    "context": {
                        "projectName": "NexusPlan Auth System",
                        "task": {
                            "title": "Implement login endpoint",
                            "status": "IN_PROGRESS",
                            "priority": "HIGH",
                            "description": "Build POST /auth/login with JWT token issuance.",
                        },
                    },
                },
                request_only=True,
            ),
            OpenApiExample(
                "Request — no context",
                value={"message": "How should I prioritise my tasks for this sprint?"},
                request_only=True,
            ),
            OpenApiExample(
                "Success response",
                value={
                    "reply": (
                        "A task stuck in **IN_PROGRESS** for 3+ days is a common signal worth "
                        "investigating. Here are the key steps I'd recommend:\n\n"
                        "1. **Identify the blocker** — Is it a technical dependency, unclear requirements, "
                        "or resource constraint?\n"
                        "2. **Time-box it** — Set a 1-day deadline to either unblock or escalate.\n"
                        "3. **Break it down** — If it's too large, split into smaller sub-tasks.\n\n"
                        "Given this is a HIGH priority task, consider flagging it in your next standup."
                    ),
                    "tokensUsed": 521,
                    "modelUsed": "gemini/gemini-2.0-flash",
                    "logId": "9ab85f64-5717-4562-b3fc-2c963f66afa6",
                },
                response_only=True,
            ),
        ],
        tags=_AI_TAG,
    )
    @action(detail=False, methods=["post"], url_path="copilot")
    def copilot(self, request: Request) -> Response:
        """
        Answer a user's project/task question with intelligent copilot advice.

        Flow:
          1. Validate input (message + optional context dict).
          2. Resolve the requesting user from the X-User-Id gateway header.
          3. Call copilot_chat (Gemini → Grok → OpenRouter fallback).
          4. Persist an AIRequestLog (promptType=GENERIC) for audit.
          5. Return the copilot reply to the frontend.
        """

        # ── 1. Validate input ──────────────────────────────────────────────
        in_serializer = CopilotInputSerializer(data=request.data)
        if not in_serializer.is_valid():
            return Response(in_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message      = in_serializer.validated_data["message"]
        context_data = in_serializer.validated_data.get("context", {})

        # ── 2. Resolve user ────────────────────────────────────────────────
        user_id, err = _require_user_id(request)
        if err:
            return err

        # ── 3. Call LLM ────────────────────────────────────────────────────
        try:
            result = copilot_chat(
                user_message=message,
                context_data=context_data,
            )
        except RuntimeError as exc:
            logger.error(
                "copilot_chat failed | user=%s | error=%s", user_id, exc
            )
            return Response(
                {"detail": f"AI provider error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ── 4. Persist audit log ───────────────────────────────────────────
        project_id = context_data.get("projectId")
        log = AIRequestLog.objects.create(
            userId     = user_id,
            projectId  = project_id or None,
            promptType = PromptType.GENERIC,
            tokensUsed = result.tokens_used,
        )
        logger.info(
            "AIRequestLog created | id=%s | user=%s | project=%s | tokens=%d | type=GENERIC",
            log.id, user_id, project_id, result.tokens_used,
        )

        # ── 5. Serialize & return ──────────────────────────────────────────
        out = CopilotOutputSerializer({
            "reply":      result.text,
            "tokensUsed": result.tokens_used,
            "modelUsed":  result.model_used,
            "logId":      str(log.id),
        })
        return Response(out.data, status=status.HTTP_200_OK)
