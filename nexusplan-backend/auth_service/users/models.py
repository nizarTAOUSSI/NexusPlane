import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UserManager


class UserRole(models.TextChoices):
    MEMBER = "MEMBER", "Member"
    PROJECT_MANAGER = "PROJECT_MANAGER", "Project Manager"
    ADMIN = "ADMIN", "Admin"


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
