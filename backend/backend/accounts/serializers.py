from django.contrib.auth import password_validation
from django.contrib.auth.models import BaseUserManager
from rest_framework import serializers
from .models import User


class SignupSerializer(serializers.ModelSerializer):
    """
    Server-side validation is what actually protects the system.
    - `email` has `unique=True` on the model AND we re-check it here so we can
      return a clean field-level error instead of a raw 500/IntegrityError.
    - Passwords are validated with Django's built-in validators (length,
      similarity to user attrs, common-password list, not-all-numeric).
    - password/password2 must match.
    """
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "password", "password2"]

    def validate_email(self, value):
        value = BaseUserManager.normalize_email(value).lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        # run Django's password validators against a temp (unsaved) user
        temp_user = User(email=attrs.get("email"), first_name=attrs.get("first_name", ""))
        password_validation.validate_password(attrs["password"], user=temp_user)
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "date_joined", "last_login", "is_active"]
        read_only_fields = ["id", "email", "role", "date_joined", "last_login"]


class AdminUserListSerializer(serializers.ModelSerializer):
    """What the admin dashboard's 'all logged in users' table shows."""
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "is_active", "date_joined", "last_login", "last_login_ip"]


class PromoteAdminSerializer(serializers.Serializer):
    """Used by an existing admin to create ANOTHER admin account."""
    email = serializers.EmailField()
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value):
        value = BaseUserManager.normalize_email(value).lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(role="admin", **validated_data)


# ---------------------------------------------------------------------------
# Supabase-backed auth (Google OAuth + Email OTP)
# ---------------------------------------------------------------------------

class SupabaseTokenSerializer(serializers.Serializer):
    """Frontend sends the Supabase access_token it got from Google OAuth (or a magic-link callback)."""
    access_token = serializers.CharField()


class RequestOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    token = serializers.CharField()  # the 6-digit code emailed to the user