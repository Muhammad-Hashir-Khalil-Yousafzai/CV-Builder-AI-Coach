from django.db import models
from pgvector.django import VectorField, HnswIndex


class Job(models.Model):
    """A job listing pulled from an external source (RemoteOK, etc.),
    with a 384-dim embedding for semantic matching against a CVProfile."""

    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    is_remote = models.BooleanField(default=False)
    salary = models.CharField(max_length=100, blank=True)  # kept as text — sources format this inconsistently
    job_url = models.URLField(unique=True)  # prevents duplicate listings on re-sync
    description = models.TextField(blank=True)
    source = models.CharField(max_length=50, default="remoteok")

    # 384-dimensional vector from all-MiniLM-L6-v2 (self-hosted, see services.py)
    embedding = VectorField(dimensions=384)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            HnswIndex(
                name="job_embedding_hnsw_idx",
                fields=["embedding"],
                opclasses=["vector_cosine_ops"],
            )
        ]

    def __str__(self):
        return f"{self.title} @ {self.company}"


class JobTracker(models.Model):
    """A job the user saved and/or is tracking through the hiring pipeline."""

    STATUSES = [
        ("saved", "Saved"),
        ("applied", "Applied"),
        ("interview", "Interview"),
        ("offer", "Offer"),
        ("rejected", "Rejected"),
    ]

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="tracked_jobs")
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="trackers")
    status = models.CharField(max_length=12, choices=STATUSES, default="saved")
    match_score = models.FloatField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        unique_together = [("user", "job")]


class CoachChat(models.Model):
    """Saved AI-coach conversation: one per (user, job), plus one general chat per user (job=None)."""

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="coach_chats")
    job = models.ForeignKey(Job, on_delete=models.CASCADE, null=True, blank=True, related_name="coach_chats")
    messages = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "job"], name="uniq_coachchat_user_job"),
            models.UniqueConstraint(fields=["user"], condition=models.Q(job__isnull=True), name="uniq_coachchat_user_general"),
        ]
