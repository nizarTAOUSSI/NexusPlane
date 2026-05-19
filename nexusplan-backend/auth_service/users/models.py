import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UserManager


class UserRole(models.TextChoices):
    MEMBER = "MEMBER", "Member"
    PROJECT_MANAGER = "PROJECT_MANAGER", "Project Manager"
    ADMIN = "ADMIN", "Admin"
    BOT = "BOT", "Bot"


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model for NexusPlan.
    Uses email as the unique authentication identifier instead of username.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150)
    avatar = models.URLField(null=True, blank=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.MEMBER,
    )

    # Required by AbstractBaseUser / Django admin
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)

    createdAt = models.DateTimeField(auto_now_add=True)
    updatedAt = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return self.email


class Token(models.Model):
    """
    Persists issued JWT token pairs for audit/revocation purposes.
    The canonical revocation mechanism is simplejwt's blacklist;
    this table provides an additional business-level trace.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens")
    accessToken = models.TextField()
    refreshToken = models.TextField()
    expiresAt = models.DateTimeField()
    isValid = models.BooleanField(default=True)

    class Meta:
        db_table = "tokens"

    def __str__(self) -> str:
        return f"Token({self.user.email}, valid={self.isValid})"


class DirectMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(User, related_name="sent_dms", on_delete=models.CASCADE)
    receiver = models.ForeignKey(User, related_name="received_dms", on_delete=models.CASCADE)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = "direct_messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"DM {self.sender.email} -> {self.receiver.email}"


class GroupMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(User, related_name="group_messages", on_delete=models.CASCADE)
    room_id = models.CharField(max_length=100)
    room_type = models.CharField(max_length=50, default="group")
    message = models.TextField()
    reply_to = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="replies",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "group_messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"GroupMsg in {self.room_id} by {self.sender.email}"


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, related_name="notifications", on_delete=models.CASCADE)
    from_user = models.ForeignKey(User, related_name="sent_notifications", on_delete=models.SET_NULL, null=True, blank=True)
    type = models.CharField(max_length=50)
    data = models.JSONField(default=dict)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification {self.type} for {self.user.email}"


class DeactivationAppeal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "deactivation_appeals"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Appeal from {self.email}"


