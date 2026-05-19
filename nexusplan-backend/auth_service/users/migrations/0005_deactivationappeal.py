from django.db import migrations, models
import uuid

class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_groupmessage_reply_to"),
    ]

    operations = [
        migrations.CreateModel(
            name="DeactivationAppeal",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("email", models.EmailField(max_length=254)),
                ("message", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "deactivation_appeals",
                "ordering": ["-created_at"],
            },
        ),
    ]
