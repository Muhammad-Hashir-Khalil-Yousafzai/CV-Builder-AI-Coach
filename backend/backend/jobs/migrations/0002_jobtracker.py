import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("jobs", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="JobTracker",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("saved", "Saved"), ("applied", "Applied"), ("interview", "Interview"), ("offer", "Offer"), ("rejected", "Rejected")], default="saved", max_length=12)),
                ("match_score", models.FloatField(blank=True, null=True)),
                ("applied_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("job", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="trackers", to="jobs.job")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tracked_jobs", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at"], "unique_together": {("user", "job")}},
        ),
    ]
