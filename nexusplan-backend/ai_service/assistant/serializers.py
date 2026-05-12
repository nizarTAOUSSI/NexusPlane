"""
serializers.py — Input/Output contracts for the NexusPlan AI assistant API.

Serializers defined:
  ── Task Generation ──────────────────────────────────────────────────────
  GenerateTasksInputSerializer    POST /api/ai/generate-tasks/
  GeneratedTaskSerializer         Shape of one AI-generated task
  GenerateTasksOutputSerializer   Envelope (tasks + metadata)

  ── Project Summary ──────────────────────────────────────────────────────
  TaskContextSerializer           Lightweight task object for input payloads
  SummarizeProjectInputSerializer POST /api/ai/summarize/
  SummarizeProjectOutputSerializer

  ── Copilot Chat ─────────────────────────────────────────────────────────
  CopilotInputSerializer          POST /api/ai/copilot/
  CopilotOutputSerializer
"""

from rest_framework import serializers


# ============================================================================
# Task Generation
# ============================================================================

class GenerateTasksInputSerializer(serializers.Serializer):
    """Body expected by POST /api/ai/generate-tasks/"""

    description = serializers.CharField(
        min_length=10,
        max_length=4000,
        help_text=(
            "Free-text description of the project or feature to decompose into tasks. "
            "Min 10 characters, max 4 000 characters."
        ),
    )
    projectId = serializers.UUIDField(
        required=False,
        allow_null=True,
        default=None,
        help_text="UUID of the project this generation is associated with (optional).",
    )


_PRIORITY_CHOICES = ["HIGH", "MEDIUM", "LOW"]


class GeneratedTaskSerializer(serializers.Serializer):
    """Represents one AI-generated task."""

    title = serializers.CharField(
        help_text="Concise task title (≤ 80 characters).",
    )
    description = serializers.CharField(
        help_text="Actionable task description (1–3 sentences).",
    )
    priority = serializers.ChoiceField(
        choices=_PRIORITY_CHOICES,
        help_text="Task priority: HIGH, MEDIUM, or LOW.",
    )


class GenerateTasksOutputSerializer(serializers.Serializer):
    """Full response body returned by POST /api/ai/generate-tasks/"""

    tasks = GeneratedTaskSerializer(
        many=True,
        help_text="Array of AI-generated tasks ready for review.",
    )
    tokensUsed = serializers.IntegerField(
        help_text="Total LLM tokens consumed by this request.",
    )
    modelUsed = serializers.CharField(
        help_text="Identifier of the LLM provider/model that responded.",
    )
    logId = serializers.UUIDField(
        help_text="UUID of the AIRequestLog record created for audit/cost-tracking.",
    )


# ============================================================================
# Project Summary
# ============================================================================

class TaskContextSerializer(serializers.Serializer):
    """
    Lightweight task object supplied by the frontend when calling summarize
    or copilot endpoints. All fields are optional — the AI works with whatever
    is provided.
    """

    title = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Task title.",
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Short task description.",
    )
    status = serializers.CharField(
        required=False,
        allow_blank=True,
        default="UNKNOWN",
        help_text='Task status (e.g. "TODO", "IN_PROGRESS", "DONE").',
    )
    priority = serializers.CharField(
        required=False,
        allow_blank=True,
        default="MEDIUM",
        help_text='Task priority: "HIGH", "MEDIUM", or "LOW".',
    )
    assignee = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Name or ID of the assignee (optional).",
    )
    dueDate = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Due date (any string format — used for AI context only).",
    )


class SummarizeProjectInputSerializer(serializers.Serializer):
    """Body expected by POST /api/ai/summarize/"""

    projectId = serializers.UUIDField(
        help_text="UUID of the project to summarise.",
    )
    projectName = serializers.CharField(
        max_length=200,
        default="Unnamed Project",
        required=False,
        help_text="Human-readable project name displayed in the summary.",
    )
    tasks = TaskContextSerializer(
        many=True,
        required=False,
        default=list,
        help_text="Array of task objects representing the current project backlog.",
    )


class SummarizeProjectOutputSerializer(serializers.Serializer):
    """Full response body returned by POST /api/ai/summarize/"""

    summary = serializers.CharField(
        help_text="Executive prose summary of the project's current state.",
    )
    tokensUsed = serializers.IntegerField(
        help_text="Total LLM tokens consumed by this request.",
    )
    modelUsed = serializers.CharField(
        help_text="Identifier of the LLM provider/model that responded.",
    )
    logId = serializers.UUIDField(
        help_text="UUID of the AIRequestLog record created for audit/cost-tracking.",
    )


# ============================================================================
# Copilot Chat
# ============================================================================

class CopilotInputSerializer(serializers.Serializer):
    """Body expected by POST /api/ai/copilot/"""

    message = serializers.CharField(
        min_length=3,
        max_length=2000,
        help_text="The user's question or request to the NexusPlan Copilot.",
    )
    context = serializers.DictField(
        required=False,
        default=dict,
        help_text=(
            "Optional context object that may include: projectId (UUID string), "
            "projectName (str), task (task detail dict), recentTasks (list of task dicts). "
            "Any extra keys are forwarded to the LLM for richer responses."
        ),
    )


class CopilotOutputSerializer(serializers.Serializer):
    """Full response body returned by POST /api/ai/copilot/"""

    reply = serializers.CharField(
        help_text="The Copilot's response to the user's message.",
    )
    tokensUsed = serializers.IntegerField(
        help_text="Total LLM tokens consumed by this request.",
    )
    modelUsed = serializers.CharField(
        help_text="Identifier of the LLM provider/model that responded.",
    )
    logId = serializers.UUIDField(
        help_text="UUID of the AIRequestLog record created for audit/cost-tracking.",
    )
