from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import path, include

def health(request):
    """GET /health/ -> cheap "I'm awake" check. /health/?db=1 also runs SELECT 1, which keeps the free database active too."""
    if request.GET.get("db"):
        try:
            with connection.cursor() as c:
                c.execute("SELECT 1")
        except Exception:
            return JsonResponse({"status": "db_error"}, status=503)
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health),
    path("admin/", admin.site.urls),  # Django's built-in admin site (separate from our API admin role)
    path("api/", include("accounts.urls")),
    path("api/", include("profiles.urls")),
    path("api/", include("jobs.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)