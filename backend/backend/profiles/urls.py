from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MyCVProfileView, ImportCVView, ATSScoreView, ATSApplyView, SkillBulletDraftView, AddBulletView, RewriteBulletView, ReplaceBulletView, AdminCVProfileDetailView,
    EducationViewSet, ExperienceViewSet, SkillViewSet, ProjectViewSet, CertificationViewSet,
)
from .dashboard_views import (
    DashboardView, OnboardingView, VersionListCreateView, VersionDetailView, VersionRestoreView,
)

router = DefaultRouter()
router.register("education", EducationViewSet, basename="education")
router.register("experience", ExperienceViewSet, basename="experience")
router.register("skills", SkillViewSet, basename="skill")
router.register("projects", ProjectViewSet, basename="project")
router.register("certifications", CertificationViewSet, basename="certification")

urlpatterns = [
    path("profile/me/", MyCVProfileView.as_view(), name="my_profile"),
    path("profile/import-cv/", ImportCVView.as_view(), name="import_cv"),
    path("profile/skill-bullet/", SkillBulletDraftView.as_view(), name="skill_bullet"),
    path("profile/rewrite-bullet/", RewriteBulletView.as_view(), name="rewrite_bullet"),
    path("profile/replace-bullet/", ReplaceBulletView.as_view(), name="replace_bullet"),
    path("profile/add-bullet/", AddBulletView.as_view(), name="add_bullet"),
    path("profile/ats-apply/", ATSApplyView.as_view(), name="ats_apply"),
    path("profile/ats-score/", ATSScoreView.as_view(), name="ats_score"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("dashboard/onboarding/", OnboardingView.as_view(), name="onboarding"),
    path("profile/versions/", VersionListCreateView.as_view(), name="versions"),
    path("profile/versions/<int:pk>/", VersionDetailView.as_view(), name="version_detail"),
    path("profile/versions/<int:pk>/restore/", VersionRestoreView.as_view(), name="version_restore"),
    path("profile/", include(router.urls)),
    path("admin/users/<int:user_id>/profile/", AdminCVProfileDetailView.as_view(), name="admin_user_profile"),
]
