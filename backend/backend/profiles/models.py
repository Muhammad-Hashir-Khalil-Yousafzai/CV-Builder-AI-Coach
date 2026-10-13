from django.conf import settings
from django.db import models


def cv_photo_path(instance, filename):
    return f"cv_photos/user_{instance.user_id}/{filename}"


class CVProfile(models.Model):
    """One-to-one CV/resume data shown on the user's own dashboard."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cv_profile")
    full_name = models.CharField(max_length=200, blank=True)
    photo = models.ImageField(upload_to=cv_photo_path, blank=True, null=True)
    headline = models.CharField(max_length=150, blank=True)          # e.g. "Full-Stack Developer"
    phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=255, blank=True)
    date_of_birth = models.DateField(blank=True, null=True)
    summary = models.TextField(blank=True)
    linkedin_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    portfolio_url = models.URLField(blank=True)
    # Onboarding (dashboard): what the user is aiming for
    target_role = models.CharField(max_length=150, blank=True)
    experience_level = models.CharField(max_length=20, blank=True)  # student | junior | mid | senior
    onboarded = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"CV of {self.user.email}"


class CareerGoal(models.Model):
    """Onboarding answers: the user's career goals (one row per profile)."""
    profile = models.OneToOneField(CVProfile, on_delete=models.CASCADE, related_name="career_goal")
    fields = models.JSONField(default=list, blank=True)    # up to 3 industries, e.g. ["Software & IT"]
    work_mode = models.CharField(max_length=20, blank=True)  # Remote | Hybrid | On-site
    job_type = models.CharField(max_length=20, blank=True)   # Full-time | Internship | Freelance | Contract
    goals = models.JSONField(default=list, blank=True)     # what the user wants help with
    timeline = models.CharField(max_length=30, blank=True)   # ASAP | 1-3 months | ...
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Career goals of {self.profile.user.email}"


class Education(models.Model):
    profile = models.ForeignKey(CVProfile, on_delete=models.CASCADE, related_name="education")
    institute = models.CharField(max_length=200)
    degree = models.CharField(max_length=200)
    start_year = models.PositiveIntegerField()
    end_year = models.PositiveIntegerField(blank=True, null=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-start_year"]


class Experience(models.Model):
    profile = models.ForeignKey(CVProfile, on_delete=models.CASCADE, related_name="experience")
    company = models.CharField(max_length=200)
    role = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-start_date"]


class Skill(models.Model):
    profile = models.ForeignKey(CVProfile, on_delete=models.CASCADE, related_name="skills")
    name = models.CharField(max_length=100)
    level = models.CharField(
        max_length=20,
        choices=[("beginner", "Beginner"), ("intermediate", "Intermediate"), ("advanced", "Advanced"), ("expert", "Expert")],
        default="intermediate",
    )


class Project(models.Model):
    profile = models.ForeignKey(CVProfile, on_delete=models.CASCADE, related_name="projects")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    link = models.URLField(blank=True)
    image = models.ImageField(upload_to="project_images/", blank=True, null=True)


class Certification(models.Model):
    profile = models.ForeignKey(CVProfile, on_delete=models.CASCADE, related_name="certifications")
    title = models.CharField(max_length=200)
    issuer = models.CharField(max_length=200, blank=True)
    year = models.PositiveIntegerField(blank=True, null=True)


class CVVersion(models.Model):
    """A saved snapshot ("past CV") of the whole profile. `data` mirrors the CV serializer output
    (without photo / project images). Auto snapshots are taken before imports and restores."""
    KIND_CHOICES = [("manual", "Saved by you"), ("auto", "Auto-saved")]

    profile = models.ForeignKey(CVProfile, on_delete=models.CASCADE, related_name="versions")
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default="manual")
    data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.name} ({self.profile_id})"


class ATSCheck(models.Model):
    """Latest ATS score for each distinct job description a user has checked (dashboard history)."""
    profile = models.ForeignKey(CVProfile, on_delete=models.CASCADE, related_name="ats_checks")
    jd_hash = models.CharField(max_length=40)
    job_title = models.CharField(max_length=150, blank=True)
    score = models.PositiveSmallIntegerField()
    grade = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        unique_together = [("profile", "jd_hash")]

