import jwt
import requests
from jwt import PyJWKClient

from django.conf import settings
from django.db import IntegrityError
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .permissions import IsAdmin
from .serializers import (
    SignupSerializer, UserSerializer, AdminUserListSerializer, PromoteAdminSerializer,
    SupabaseTokenSerializer, RequestOTPSerializer, VerifyOTPSerializer,
)


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")


class SignupView(generics.CreateAPIView):
    """
    POST /api/auth/signup/
    Even though the frontend does a live "is this email free?" check,
    two tabs (or two people) could submit the SAME email in the tiny window
    between that check and this request — a classic race condition / TOCTOU
    bug. We do NOT trust the client: validate_email() re-checks uniqueness,
    and we additionally catch IntegrityError from the DB's unique constraint
    as a final safety net, so a race never produces a 500 or duplicate row.
    """
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "signup"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = serializer.save()
        except IntegrityError:
            return Response(
                {"email": ["An account with this email already exists."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class CheckEmailView(APIView):
    """
    GET /api/auth/check-email/?email=someone@example.com
    Powers the client-side "this email is already taken" instant feedback.
    Deliberately rate-limited (throttle scope 'check_email') and returns a
    generic boolean only — no user details — to reduce account enumeration.
    This is a UX convenience only; SignupView still re-validates server-side.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "check_email"

    def get(self, request):
        email = (request.query_params.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "email query param is required."}, status=400)
        exists = User.objects.filter(email__iexact=email).exists()
        return Response({"email": email, "available": not exists})


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    """POST /api/auth/login/  {email, password} -> access, refresh, user"""
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = User.objects.get(email=request.data.get("email", "").lower().strip())
            user.last_login_ip = _client_ip(request)
            user.save(update_fields=["last_login_ip"])
        return response


class LogoutView(APIView):
    """POST /api/auth/logout/  {refresh} -> blacklists the refresh token."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh", "")).blacklist()
        except Exception:
            pass
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/auth/me/ — the logged-in user's own account fields."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class AdminUserListView(generics.ListAPIView):
    """
    GET /api/admin/users/
    Admin-only: list of every registered/logged-in user with last_login,
    used for the admin dashboard table.
    """
    serializer_class = AdminUserListSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["role", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    queryset = User.objects.all()


class AdminCreateAdminView(generics.CreateAPIView):
    """
    POST /api/admin/admins/
    Admin-only: lets an existing admin create ANOTHER admin account.
    Kept as its own endpoint (rather than a PATCH toggling role) so it's
    auditable and always requires a fresh password, not a role flip on
    someone else's account.
    """
    serializer_class = PromoteAdminSerializer
    permission_classes = [IsAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = serializer.save()
        except IntegrityError:
            return Response({"email": ["An account with this email already exists."]}, status=400)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Supabase-backed auth (Google OAuth + Email OTP)
#
# Supabase only verifies WHO the person is (via Google or a one-time code).
# Once verified, we get-or-create the matching local `User` by email and
# issue our OWN simplejwt access/refresh pair — same response shape as
# LoginView — so MeView, IsAdmin, and everything else downstream needs
# zero changes.
#
# Supabase signs access tokens with ES256 using rotating JWT Signing Keys,
# not a static HS256 shared secret — so verification goes through the
# project's public JWKS endpoint via PyJWKClient rather than a fixed secret.
# ---------------------------------------------------------------------------

_jwk_client = PyJWKClient(f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json")


def _verify_supabase_token(token):
    signing_key = _jwk_client.get_signing_key_from_jwt(token)
    return jwt.decode(token, signing_key.key, algorithms=["ES256"], audience="authenticated")


def _issue_tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {
        "user": UserSerializer(user).data,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


def _get_or_create_from_supabase_payload(payload):
    """payload = decoded Supabase JWT. Maps to the existing User model by email."""
    email = payload.get("email")
    if not email:
        raise ValueError("Supabase token had no email claim.")
    email = email.lower().strip()

    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            "role": "user",
            "is_staff": False,
            "is_superuser": False,
        },
    )
    if created:
        user.set_unusable_password()  # this account only ever logs in via Supabase
        user.save(update_fields=["password"])
    return user


class SupabaseTokenExchangeView(APIView):
    """
    POST /api/auth/supabase/exchange/   {access_token}

    Used for BOTH Google OAuth and magic-link callbacks: verifies the
    Supabase JWT, gets/creates the matching local User by email, and issues
    this app's normal simplejwt access/refresh pair.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = SupabaseTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            payload = _verify_supabase_token(serializer.validated_data["access_token"])
        except jwt.InvalidTokenError:
            return Response({"detail": "Invalid or expired token."}, status=401)

        try:
            user = _get_or_create_from_supabase_payload(payload)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        if not user.is_active:
            return Response({"detail": "Account is disabled."}, status=403)

        user.last_login_ip = _client_ip(request)
        user.save(update_fields=["last_login_ip"])
        return Response(_issue_tokens_for(user), status=status.HTTP_200_OK)


class RequestOTPView(APIView):
    """POST /api/auth/otp/request/   {email} -> triggers Supabase to email a one-time code."""
    permission_classes = [permissions.AllowAny]
    throttle_scope = "signup"

    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        resp = requests.post(
            f"{settings.SUPABASE_URL}/auth/v1/otp",
            headers={"apikey": settings.SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": email, "create_user": True},
            timeout=10,
        )
        if resp.status_code >= 400:
            return Response({"detail": "Could not send code."}, status=400)
        return Response({"detail": "Code sent."}, status=200)


class VerifyOTPView(APIView):
    """POST /api/auth/otp/verify/   {email, token} -> issues this app's JWT pair."""
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        resp = requests.post(
            f"{settings.SUPABASE_URL}/auth/v1/verify",
            headers={"apikey": settings.SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": data["email"], "token": data["token"], "type": "email"},
            timeout=10,
        )
        result = resp.json()
        if resp.status_code >= 400 or "access_token" not in result:
            return Response({"detail": "Invalid or expired code."}, status=400)

        try:
            payload = _verify_supabase_token(result["access_token"])
        except jwt.InvalidTokenError:
            return Response({"detail": "Invalid or expired token."}, status=401)

        try:
            user = _get_or_create_from_supabase_payload(payload)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        if not user.is_active:
            return Response({"detail": "Account is disabled."}, status=403)

        user.last_login_ip = _client_ip(request)
        user.save(update_fields=["last_login_ip"])
        return Response(_issue_tokens_for(user), status=status.HTTP_200_OK)