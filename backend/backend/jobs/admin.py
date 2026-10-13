from django.contrib import admin
from .models import Job


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "location", "is_remote", "source", "created_at")
    list_filter = ("is_remote", "source")
    search_fields = ("title", "company", "location")
