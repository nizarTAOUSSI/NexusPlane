"""
serializers.py — Input/Output contracts for the assistant API.

Three serializers are defined:
  GenerateTasksInputSerializer  — validates the POST body
  GeneratedTaskSerializer       — shape of one AI-generated task
  GenerateTasksOutputSerializer — wraps the list + metadata for Swagger docs
"""

import uuid

from rest_framework import serializers


# ---------------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------------

class GenerateTasksInputSerializer(serializers.Serializer):
    """
    Body expected by POST /api/generate-tasks/
    """

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


# ---------------------------------------------------------------------------
# Output — individual task
# ---------------------------------------------------------------------------

_PRIORITY_CHOICES = ["HIGH", "MEDIUM", "LOW"]


class GeneratedTaskSerializer(serializers.Serializer):
    """
    Represents one AI-generated task.
    The frontend validates these and then POSTs them to task_service.
    """

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


# ---------------------------------------------------------------------------
# Output — envelope
# ---------------------------------------------------------------------------

class GenerateTasksOutputSerializer(serializers.Serializer):
    """
    Full response body returned by POST /api/generate-tasks/
    """

    tasks = GeneratedTaskSerializer(
        many=True,
        help_text="Array of AI-generated tasks ready for review.",
    )
    tokensUsed = serializers.IntegerField(
        help_text="Total LLM tokens consumed by this request.",
    )
    logId = serializers.UUIDField(
        help_text="UUID of the AIRequestLog record created for audit/cost-tracking.",
    )
