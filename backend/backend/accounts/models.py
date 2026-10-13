from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ("user", "User"),
        ("admin", "Admin"),
    )

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="user")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    date_joined = models.DateTimeField(default=timezone.now)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email

    @property
    def is_admin(self):
        return self.role == "admin" or self.is_superuser

    def save(self, *args, **kwargs):
        self.email = self.email.lower().strip()
        # keep role, is_staff, and is_superuser consistent no matter
        # which one was set first (manager, admin site, shell, etc.)
        if self.role == "admin":
            self.is_staff = True
        if self.is_superuser:
            self.role = "admin"
            self.is_staff = True
        super().save(*args, **kwargs)