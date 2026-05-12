"""
models.py — AIRequestLog
Keeps an audit trail of every AI call for cost-control and analytics.
Each field referencing users/projects uses UUIDField (microservice boundary).
"""

import uuid

from django.db import models


class PromptType(models.TextChoices):
    TASK_GENERATION   = "TASK_GENERATION",   "Task Generation"
    PROJECT_SUMMARY   = "PROJECT_SUMMARY",   "Project Summary"
    TASK_DESCRIPTION  = "TASK_DESCRIPTION",  "Task Description"
    DASHBOARD_SUMMARY = "DASHBOARD_SUMMARY", "Dashboard Summary"
    GENERIC           = "GENERIC",           "Generic"


class AIRequestLog(models.Model):
    """Immutable audit record of one AI inference request."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    userId = models.UUIDField(
        db_index=True,
        help_text="UUID of the requesting user (from auth_service).",
    )
    projectId = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="UUID of the related project (from project_service), if any.",
    )

    promptType = models.CharField(
        max_length=30,
        choices=PromptType.choices,
        default=PromptType.GENERIC,
        help_text="Category of the AI prompt that was executed.",
    )

    tokensUsed = models.IntegerField(
        default=0,
        help_text="Total tokens consumed by this request (input + output).",
    )

    createdAt = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table  = "ai_request_logs"
        ordering  = ["-createdAt"]
        indexes   = [
            models.Index(fields=["userId",    "promptType"], name="idx_log_user_type"),
            models.Index(fields=["projectId", "promptType"], name="idx_log_project_type"),
        ]

    def __str__(self) -> str:
        return (
            f"[{self.promptType}] user={self.userId} "
            f"tokens={self.tokensUsed} @ {self.createdAt:%Y-%m-%d %H:%M}"
        )
