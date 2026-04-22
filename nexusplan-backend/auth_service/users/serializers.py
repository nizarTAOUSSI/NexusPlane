from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User, UserRole


# ---------------------------------------------------------------------------
# User representation
# ---------------------------------------------------------------------------


class UserProfileSerializer(serializers.ModelSerializer):
    """Read / partial-update serializer for the authenticated user's profile."""

    class Meta:
        model = User
        fields = ("id", "email", "username", "avatar", "role", "createdAt", "updatedAt")
        read_only_fields = ("id", "email", "createdAt", "updatedAt")


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
