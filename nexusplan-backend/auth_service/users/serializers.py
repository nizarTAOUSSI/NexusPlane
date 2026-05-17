import os
import uuid
from urllib.parse import urlparse

from django.conf import settings
from django.core.files.storage import default_storage
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User, UserRole


# ---------------------------------------------------------------------------
# User representation
# ---------------------------------------------------------------------------


class UserProfileSerializer(serializers.ModelSerializer):
    """Read / partial-update serializer for the authenticated user's profile."""
    has_password = serializers.SerializerMethodField()
    avatar_file = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "avatar",
            "avatar_file",
            "role",
            "createdAt",
            "updatedAt",
            "has_password",
        )
        read_only_fields = ("id", "email", "createdAt", "updatedAt", "has_password")

    def get_has_password(self, obj) -> bool:
        if not obj.password:
            return False
        return obj.has_usable_password()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        avatar = data.get("avatar")
        request = self.context.get("request")
        if avatar and request and avatar.startswith("/"):
            data["avatar"] = request.build_absolute_uri(avatar)
        return data

    def _delete_old_local_avatar_if_any(self, avatar_url: str) -> None:
        if not avatar_url:
            return
        path = urlparse(avatar_url).path
        if not path.startswith(settings.MEDIA_URL):
            return
        storage_path = path[len(settings.MEDIA_URL):]
        if storage_path and default_storage.exists(storage_path):
            default_storage.delete(storage_path)

    def update(self, instance, validated_data):
        avatar_file = validated_data.pop("avatar_file", None)
        if avatar_file:
            old_avatar = instance.avatar or ""
            self._delete_old_local_avatar_if_any(old_avatar)

            _, ext = os.path.splitext(avatar_file.name or "")
            safe_ext = ext.lower() if ext else ".jpg"
            filename = f"avatars/{uuid.uuid4().hex}{safe_ext}"
            stored_path = default_storage.save(filename, avatar_file)
            validated_data["avatar"] = f"{settings.MEDIA_URL}{stored_path}"

        return super().update(instance, validated_data)


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        validators=[validate_password],
    )
    password2 = serializers.CharField(write_only=True, label="Confirm password")

    class Meta:
        model = User
        fields = ("email", "username", "password", "password2", "avatar", "role")
        extra_kwargs = {
            "avatar": {"required": False},
            "role": {"required": False},
        }

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs.pop("password2"):
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data: dict) -> User:
        return User.objects.create_user(**validated_data)


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class LoginResponseSerializer(serializers.Serializer):
    """Shape of the successful login response — used only for Swagger docs."""

    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserProfileSerializer()
    provider = serializers.CharField()

class GoogleLoginSerializer(serializers.Serializer):
    credential = serializers.CharField(help_text="Google ID token from frontend")



# ---------------------------------------------------------------------------
# Password change
# ---------------------------------------------------------------------------


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        validators=[validate_password],
    )
    new_password2 = serializers.CharField(write_only=True, label="Confirm new password")

    def validate(self, attrs: dict) -> dict:
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError(
                {"new_password": "New passwords do not match."}
            )
        return attrs


# ---------------------------------------------------------------------------
# Logout (request body)
# ---------------------------------------------------------------------------


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(help_text="The refresh token to blacklist.")
