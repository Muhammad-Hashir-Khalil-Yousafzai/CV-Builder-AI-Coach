import os
from pathlib import Path
from datetime import timedelta
from decouple import config, Csv
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = config("SECRET_KEY", default="dev-secret-key-change-in-production")
DEBUG = config("DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="127.0.0.1,localhost", cast=Csv())
# hosts set automatically by the platform (Vercel / Render): the app is reachable on them without manual config
_platform_hosts = [h for h in (config("VERCEL_URL", default=""), config("VERCEL_BRANCH_URL", default=""),
                               config("VERCEL_PROJECT_PRODUCTION_URL", default=""), config("RENDER_EXTERNAL_HOSTNAME", default="")) if h]
ALLOWED_HOSTS = [*ALLOWED_HOSTS, *_platform_hosts]

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
DJANGO_REDIRECT_URL = os.getenv("DJANGO_REDIRECT_URL")


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",

    "accounts",
    "profiles",
    "jobs",
] 

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "0")),  # set DB_CONN_MAX_AGE=60 in .env to reuse DB connections (faster)
        "CONN_HEALTH_CHECKS": True,
        "DISABLE_SERVER_SIDE_CURSORS": os.getenv("DB_PORT") == "6543",
    }
}
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Karachi"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    # Needed for AdminUserListView's filterset_fields/search_fields to
    # actually take effect — without these two backends registered, DRF
    # silently ignores ?search=/?role= and just returns every row.
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        # Prevents brute-force login attempts and email-enumeration abuse
        "login": "10/min",
        "signup": "5/min",
        "check_email": "20/min",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

# ---- Production (free hosting) ----
CSRF_TRUSTED_ORIGINS = [*config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv()), *[f"https://{h}" for h in _platform_hosts]]
try:  # serves the admin/DRF static files from gunicorn (pip install whitenoise)
    import whitenoise  # noqa: F401
    MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
except ImportError:
    pass
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")  # Render/Vercel terminate HTTPS in front of Django
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# ---- Uploaded files (CV photo, project images) -> Supabase Storage (S3-compatible) ----
# Render's free disk is wiped on every restart, so uploads must live outside the server.
# Without SUPABASE_S3_ENDPOINT (local dev) files still go to ./media like before.
if config("SUPABASE_S3_ENDPOINT", default=""):
    _public_base = config("SUPABASE_PUBLIC_BASE").replace("https://", "").replace("http://", "").rstrip("/")
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": config("SUPABASE_BUCKET"),
                "endpoint_url": config("SUPABASE_S3_ENDPOINT"),
                "access_key": config("SUPABASE_S3_ACCESS_KEY"),
                "secret_key": config("SUPABASE_S3_SECRET_KEY"),
                "region_name": config("SUPABASE_S3_REGION", default="us-east-1"),
                "custom_domain": _public_base,   # public URL of the bucket, used to build image links
                "querystring_auth": False,       # public bucket: plain URLs, no signatures
                "default_acl": None,             # Supabase has no S3 ACLs
                "addressing_style": "path",
                "signature_version": "s3v4",
                "file_overwrite": False,         # same filename twice -> no clobbering
            },
        },
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
