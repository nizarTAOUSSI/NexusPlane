from rest_framework import serializers

from .models import Task, TaskPriority, TaskStatus


class TaskSerializer(serializers.ModelSerializer):
    """Full Task representation — used for GET responses."""

    class Meta:
        model = Task
        fields = [
            "id",
            "projectId",
            "title",
            "description",
            "status",
            "priority",
            "assigneeId",
            "creatorId",
            "dueDate",
            "createdAt",
            "updatedAt",
        ]
        read_only_fields = ["id", "createdAt", "updatedAt"]


class TaskCreateSerializer(serializers.ModelSerializer):
    """
    Used for POST /tasks/.

    ``creatorId`` is injected server-side from the X-User-Id gateway header
    and must NOT be provided by the client.
    """

    class Meta:
        model = Task
        fields = [
            "projectId",
            "title",
            "description",
            "status",
            "priority",
            "assigneeId",
            "dueDate",
        ]

    def validate_status(self, value: str) -> str:
        if value not in TaskStatus.values:
            raise serializers.ValidationError(
                f"Invalid status '{value}'. Allowed: {TaskStatus.values}"
            )
        return value

    def validate_priority(self, value: str) -> str:
        if value not in TaskPriority.values:
            raise serializers.ValidationError(
                f"Invalid priority '{value}'. Allowed: {TaskPriority.values}"
            )
        return value


class TaskUpdateSerializer(serializers.ModelSerializer):
    """Used for PATCH /tasks/<id>/  — all fields optional."""

    class Meta:
        model = Task
        fields = [
            "title",
            "description",
            "status",
            "priority",
            "assigneeId",
            "dueDate",
        ]



class TaskStatusUpdateSerializer(serializers.Serializer):
    """Body accepted by the ``update_status`` custom action."""

    status = serializers.ChoiceField(choices=TaskStatus.choices)


class TaskAssignSerializer(serializers.Serializer):
    """Body accepted by the ``assign`` custom action."""

    assigneeId = serializers.UUIDField(
        allow_null=True,
        required=False,
        help_text="UUID of the user to assign. Send null to unassign.",
    )
