import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Team",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "ownerId",
                    models.UUIDField(
                        db_index=True,
                        help_text="UUID of the team creator (from auth_service).",
                    ),
                ),
                ("createdAt", models.DateTimeField(auto_now_add=True)),
                ("updatedAt", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "teams",
                "ordering": ["-createdAt"],
            },
        ),
        migrations.CreateModel(
            name="TeamMembership",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "userId",
                    models.UUIDField(
                        db_index=True,
                        help_text="UUID of the team member (from auth_service).",
                    ),
                ),
                (
                    "role",
                    models.CharField(
                        choices=[("MEMBER", "Member"), ("ADMIN", "Admin")],
                        default="MEMBER",
                        max_length=10,
                    ),
                ),
                ("joinedAt", models.DateTimeField(auto_now_add=True)),
                (
                    "team",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="projects.team",
                    ),
                ),
            ],
            options={
                "db_table": "team_memberships",
                "constraints": [
                    models.UniqueConstraint(
                        fields=("team", "userId"),
                        name="unique_team_member",
                    )
                ],
            },
        ),
    ]
