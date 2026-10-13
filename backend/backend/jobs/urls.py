from django.urls import path
from .views import JobMatchView
from .tracker_views import (
    CoachApplyView, CoachChatView, CoachChatsListView, CoachLiveTokenView, CoachLiveToolView, CoachLiveTurnView, CoachView, CoverLetterView, TrackerDetailView, TrackerListView, TrackerStatsView,
)

urlpatterns = [
    path("jobs/match/", JobMatchView.as_view(), name="job_match"),
    path("jobs/tracker/", TrackerListView.as_view(), name="tracker_list"),
    path("jobs/tracker/stats/", TrackerStatsView.as_view(), name="tracker_stats"),
    path("jobs/tracker/<int:pk>/", TrackerDetailView.as_view(), name="tracker_detail"),
    path("jobs/cover-letter/", CoverLetterView.as_view(), name="cover_letter"),
    path("jobs/coach/", CoachView.as_view(), name="coach"),
    path("jobs/coach/chat/", CoachChatView.as_view(), name="coach_chat"),
    path("jobs/coach/chats/", CoachChatsListView.as_view(), name="coach_chats"),
    path("jobs/coach/live/token/", CoachLiveTokenView.as_view(), name="coach_live_token"),
    path("jobs/coach/live/turn/", CoachLiveTurnView.as_view(), name="coach_live_turn"),
    path("jobs/coach/live/tool/", CoachLiveToolView.as_view(), name="coach_live_tool"),
    path("jobs/coach/apply/", CoachApplyView.as_view(), name="coach_apply"),
]
