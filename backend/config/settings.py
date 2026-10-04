"""Minimal Django settings. The planner is stateless, so no database is needed."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
DEBUG = os.environ.get("DEBUG", "1") == "1"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = ["corsheaders", "trips"]
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",   # lets the React app (another origin) call the API
    "django.middleware.common.CommonMiddleware",
]
CORS_ALLOW_ALL_ORIGINS = True  # tighten to your Vercel URL in production
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {}
USE_TZ = True
