import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("jobs", "0002_jobtracker"),
    ]

    operations = [
        migrations.CreateModel(
            name="CoachChat",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("messages", models.JSONField(default=list)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("job", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="coach_chats", to="jobs.job")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="coach_chats", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.AddConstraint(
            model_name="coachchat",
            constraint=models.UniqueConstraint(fields=("user", "job"), name="uniq_coachchat_user_job"),
        ),
        migrations.AddConstraint(
            model_name="coachchat",
            constraint=models.UniqueConstraint(condition=models.Q(("job__isnull", True)), fields=("user",), name="uniq_coachchat_user_general"),
        ),
    ]
