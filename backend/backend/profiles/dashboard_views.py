from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import dashboard
from .models import CareerGoal, CVProfile, CVVersion
from .serializers import CVProfileSerializer


def _profile(request):
    return CVProfile.objects.get_or_create(user=request.user)[0]


class DashboardView(APIView):
    """GET /api/dashboard/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(dashboard.build_dashboard(_profile(request), request.user))


def _str_list(value, max_items, max_len=40):
    if not isinstance(value, list):
        return []
    out = []
    for x in value:
        x = str(x).strip()[:max_len]
        if x and x not in out:
            out.append(x)
    return out[:max_items]


class OnboardingView(APIView):
    """POST /api/dashboard/onboarding/ {target_role, experience_level, fields[], work_mode, job_type, goals[], timeline} or {skip: true}"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = _profile(request)
        role = str(request.data.get("target_role") or "").strip()[:150]
        level = str(request.data.get("experience_level") or "").strip().lower()
        if not request.data.get("skip"):
            if level and level not in dashboard.LEVELS:
                return Response({"detail": "Unknown experience level."}, status=status.HTTP_400_BAD_REQUEST)
            if not role and not level:
                return Response({"detail": "Pick a role or an experience level, or skip."}, status=status.HTTP_400_BAD_REQUEST)
            profile.target_role, profile.experience_level = role, level
            CareerGoal.objects.update_or_create(profile=profile, defaults={
                "fields": _str_list(request.data.get("fields"), 3),
                "work_mode": str(request.data.get("work_mode") or "").strip()[:20],
                "job_type": str(request.data.get("job_type") or "").strip()[:20],
                "goals": _str_list(request.data.get("goals"), 6),
                "timeline": str(request.data.get("timeline") or "").strip()[:30],
            })
        profile.onboarded = True
        profile.save()
        return Response(dashboard.build_dashboard(profile, request.user))


class VersionListCreateView(APIView):
    """GET /api/profile/versions/  |  POST {name?} saves the current CV as a new version"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response([dashboard.brief(v) for v in _profile(request).versions.all()])

    def post(self, request):
        profile = _profile(request)
        if not dashboard.has_content(profile):
            return Response({"detail": "Your CV is empty. Fill it in before saving a version."}, status=status.HTTP_400_BAD_REQUEST)
        if profile.versions.filter(kind="manual").count() >= dashboard.MAX_MANUAL_VERSIONS:
            return Response({"detail": f"You can keep {dashboard.MAX_MANUAL_VERSIONS} saved CVs. Delete an old one first."}, status=status.HTTP_400_BAD_REQUEST)
        v = dashboard.save_version(profile, request.data.get("name"), "manual")
        return Response(dashboard.brief(v), status=status.HTTP_201_CREATED)


class VersionDetailView(APIView):
    """GET /api/profile/versions/<id>/ (full data for preview)  |  DELETE"""
    permission_classes = [permissions.IsAuthenticated]

    def _get(self, request, pk):
        return CVVersion.objects.filter(pk=pk, profile=_profile(request)).first()

    def get(self, request, pk):
        v = self._get(request, pk)
        if not v:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({**dashboard.brief(v), "data": v.data})

    def delete(self, request, pk):
        v = self._get(request, pk)
        if not v:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        v.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VersionRestoreView(APIView):
    """POST /api/profile/versions/<id>/restore/ - replaces the current CV (which is auto-saved first)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        profile = _profile(request)
        v = CVVersion.objects.filter(pk=pk, profile=profile).first()
        if not v:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        dashboard.restore_version(profile, v)
        return Response(CVProfileSerializer(profile, context={"request": request}).data)
