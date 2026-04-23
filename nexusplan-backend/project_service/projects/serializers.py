from rest_framework import serializers

from .models import Membership, MemberRole, Project


# ---------------------------------------------------------------------------
# Project serializers
# ---------------------------------------------------------------------------


class ProjectSerializer(serializers.ModelSerializer):
    """
    Full Project representation.

    Used for all read operations and for the create action.
    ownerId is read-only: it is resolved server-side from the X-User-Id header
    injected by the API Gateway after JWT validation — clients cannot forge it.
    """

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "description",
            "status",
            "ownerId",
            "createdAt",
            "updatedAt",
        )
        read_only_fields = ("id", "status", "ownerId", "createdAt", "updatedAt")
        extra_kwargs = {
            "name": {
                "help_text": "Human-readable name of the project.",
            },
            "description": {
                "help_text": "Optional detailed description.",
            },
        }


class ProjectUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for PUT / PATCH on an existing project.

    Only `name` and `description` are mutable after creation.
    Status transitions are handled by dedicated endpoints (archive, delete).
    """

    class Meta:
        model = Project
        fields = ("name", "description")


# ---------------------------------------------------------------------------
# Membership serializers
# ---------------------------------------------------------------------------


class MembershipSerializer(serializers.ModelSerializer):
    """
    Read-only Membership representation.

    projectId is serialized as the project's UUID (PrimaryKeyRelatedField).
    userId is the plain UUID of the auth_service user.
    """

    projectId = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "projectId", "userId", "role", "joinedAt")
        read_only_fields = ("id", "joinedAt")


class MembershipCreateSerializer(serializers.ModelSerializer):
    """
    Write serializer for inviting a user to a project (POST /memberships/).

    Validates uniqueness: a user cannot be invited twice to the same project.
    The DB-level UniqueConstraint provides a second safety net.
    """

    userId = serializers.UUIDField(
        help_text="UUID of the user to invite (must exist in auth_service)."
    )

    class Meta:
        model = Membership
        fields = ("projectId", "userId", "role")
        extra_kwargs = {
            "role": {
                "required": False,
                "default": MemberRole.VIEWER,
                "help_text": "Role to assign. Defaults to VIEWER.",
            },
            "projectId": {
                "help_text": "UUID of the target project.",
            },
        }

    def validate(self, attrs: dict) -> dict:
        if Membership.objects.filter(
            projectId=attrs["projectId"],
            userId=attrs["userId"],
        ).exists():
            raise serializers.ValidationError(
                {"userId": "This user is already a member of the project."}
            )
        return attrs


class MembershipUpdateRoleSerializer(serializers.Serializer):
    """Write serializer for PATCH /memberships/{id}/update-role/."""

    role = serializers.ChoiceField(
        choices=MemberRole.choices,
        help_text="New role to assign: VIEWER | CONTRIBUTOR | MANAGER.",
    )
