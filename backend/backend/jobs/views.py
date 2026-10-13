from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from profiles.models import CVProfile
from .serializers import JobSerializer
from .services import match_jobs_for_cv


class JobMatchView(APIView):
    """
    GET /api/jobs/match/?location=&is_remote=&limit=
    Returns the logged-in user's top job matches based on their CVProfile.
    Reuses the same JWT auth as the rest of the profiles app.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = CVProfile.objects.get_or_create(user=request.user)

        location = request.query_params.get("location")
        is_remote_param = request.query_params.get("is_remote")
        is_remote = None
        if is_remote_param is not None:
            is_remote = is_remote_param.lower() in ("1", "true", "yes")

        limit = int(request.query_params.get("limit", 50))

        matches = match_jobs_for_cv(profile, location=location, is_remote=is_remote, limit=limit)
        serializer = JobSerializer(matches, many=True)
        return Response(serializer.data)
