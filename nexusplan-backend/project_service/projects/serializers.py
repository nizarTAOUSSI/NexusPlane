from rest_framework import serializers

from .models import Membership, MemberRole, Project



class ProjectSerializer(serializers.ModelSerializer):


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


    class Meta:
        model = Project
        fields = ("name", "description")



class MembershipSerializer(serializers.ModelSerializer):


    projectId = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Membership
        fields = ("id", "projectId", "userId", "role", "joinedAt")
        read_only_fields = ("id", "joinedAt")


class MembershipCreateSerializer(serializers.ModelSerializer):


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

    role = serializers.ChoiceField(
        choices=MemberRole.choices,
        help_text="New role to assign: VIEWER | CONTRIBUTOR | MANAGER.",
    )
