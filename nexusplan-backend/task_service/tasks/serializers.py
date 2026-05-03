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
            "assigneeIds",
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
            "assigneeIds",
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
            "assigneeIds",
            "dueDate",
        ]


class TaskStatusUpdateSerializer(serializers.Serializer):
    """Body accepted by the ``update_status`` custom action."""

    status = serializers.ChoiceField(choices=TaskStatus.choices)


class TaskAssignSerializer(serializers.Serializer):
    """
    Body accepted by the ``assign`` custom action.
    Send the complete desired list — it replaces the current assignees.
    Send [] to unassign everyone.
    """

    assigneeIds = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=True,
        required=True,
        help_text="Full list of user UUIDs to assign. Send [] to unassign all.",
    )
