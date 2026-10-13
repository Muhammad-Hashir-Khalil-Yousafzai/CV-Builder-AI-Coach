from rest_framework import serializers
from .models import Job


class JobSerializer(serializers.ModelSerializer):
    match_score = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id",
            "title",
            "company",
            "location",
            "is_remote",
            "salary",
            "job_url",
            "description",
            "source",
            "match_score",
        ]

    def get_match_score(self, obj):
        # `distance` is annotated onto the queryset in services.match_jobs_for_cv().
        # Cosine distance: 0 = identical, 1 = unrelated. Convert to a 0-100 similarity first.
        distance = getattr(obj, "distance", None)
        if distance is None:
            return None

        raw_similarity = (1 - distance) * 100

        # Real-world cosine similarity for short professional text (CV vs job posting)
        # from all-MiniLM-L6-v2 realistically lands in the ~30-60% band even for genuinely
        # strong matches — it almost never reaches 90%+ like exact-text comparisons would.
        # This rescales that realistic 30-60% band into a friendlier 50-95% display range
        # so users see meaningful, readable percentages. Ranking order is unaffected —
        # this only changes what's shown, not which jobs sort higher.
        LOW, HIGH = 30, 60
        DISPLAY_LOW, DISPLAY_HIGH = 50, 95

        clamped = max(LOW, min(HIGH, raw_similarity))
        scaled = DISPLAY_LOW + (clamped - LOW) / (HIGH - LOW) * (DISPLAY_HIGH - DISPLAY_LOW)

        return round(scaled, 1)