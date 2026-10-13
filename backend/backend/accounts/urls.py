from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    SignupView, LoginView, LogoutView, CheckEmailView, MeView,
    AdminUserListView, AdminCreateAdminView,
    SupabaseTokenExchangeView, RequestOTPView, VerifyOTPView,
)

urlpatterns = [
    path("auth/signup/", SignupView.as_view(), name="signup"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/check-email/", CheckEmailView.as_view(), name="check_email"),
    path("auth/me/", MeView.as_view(), name="me"),

    # Supabase-backed auth (Google OAuth + Email OTP)
    path("auth/supabase/exchange/", SupabaseTokenExchangeView.as_view(), name="supabase_exchange"),
    path("auth/otp/request/", RequestOTPView.as_view(), name="otp_request"),
    path("auth/otp/verify/", VerifyOTPView.as_view(), name="otp_verify"),

    path("admin/users/", AdminUserListView.as_view(), name="admin_users"),
    path("admin/admins/", AdminCreateAdminView.as_view(), name="admin_create_admin"),
]