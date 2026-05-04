import uuid

from django.db import models



class TaskStatus(models.TextChoices):
    TODO        = "TODO",        "To Do"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    REVIEW      = "REVIEW",      "Review"
    DONE        = "DONE",        "Done"


class TaskPriority(models.TextChoices):
    LOW    = "LOW",    "Low"
    MEDIUM = "MEDIUM", "Medium"
    HIGH   = "HIGH",   "High"
    URGENT = "URGENT", "Urgent"


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------


class Task(models.Model):


    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    projectId = models.UUIDField(
        db_index=True,
        help_text="UUID of the project this task belongs to (from project_service).",
    )

    title = models.CharField(max_length=255)

    description = models.TextField(blank=True, default="")

    status = models.CharField(
        max_length=20,
        choices=TaskStatus.choices,
        default=TaskStatus.TODO,
    )

    priority = models.CharField(
        max_length=10,
        choices=TaskPriority.choices,
        default=TaskPriority.MEDIUM,
    )

    assigneeIds = models.JSONField(
        default=list,
        blank=True,
        help_text="List of user UUIDs assigned to this task (from auth_service).",
    )

    creatorId = models.UUIDField(
        help_text="UUID of the user who created this task (from auth_service).",
    )

    dueDate = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Optional deadline for this task.",
    )

    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tasks"
        ordering = ["-createdAt"]
        indexes = [
            models.Index(fields=["projectId", "status"],   name="idx_task_project_status"),
            models.Index(fields=["projectId", "priority"], name="idx_task_project_priority"),
        ]

    def __str__(self) -> str:
        return f"[{self.status}] {self.title} (project={self.projectId})"
