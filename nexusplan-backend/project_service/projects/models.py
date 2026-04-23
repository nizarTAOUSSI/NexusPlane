import uuid

from django.db import models


class ProjectStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    ARCHIVED = "ARCHIVED", "Archived"
    DELETED = "DELETED", "Deleted"


class MemberRole(models.TextChoices):
    VIEWER = "VIEWER", "Viewer"
    CONTRIBUTOR = "CONTRIBUTOR", "Contributor"
    MANAGER = "MANAGER", "Manager"



class Project(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=ProjectStatus.choices,
        default=ProjectStatus.ACTIVE,
    )
    ownerId = models.UUIDField(
        db_index=True,
        help_text="UUID of the project creator, resolved from auth_service.",
    )
    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects"
        ordering = ["-createdAt"]

    def __str__(self) -> str:
        return f"{self.name} [{self.status}]"



class Membership(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projectId = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships",
        db_column="project_id",
    )
    userId = models.UUIDField(
        db_index=True,
        help_text="UUID of the invited user, resolved from auth_service.",
    )
    role = models.CharField(
        max_length=20,
        choices=MemberRole.choices,
        default=MemberRole.VIEWER,
    )
    joinedAt = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "memberships"
        constraints = [
            models.UniqueConstraint(
                fields=["projectId", "userId"],
                name="unique_project_member",
            )
        ]

    def __str__(self) -> str:
        return f"User {self.userId} → Project {self.projectId_id} [{self.role}]"
