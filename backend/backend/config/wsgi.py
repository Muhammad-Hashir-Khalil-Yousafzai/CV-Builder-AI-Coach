"""WSGI entry point (used by Vercel / gunicorn)."""
import os
import sys
from pathlib import Path

# Vercel does not put the project folder on sys.path, so `config`, `accounts`, `jobs`, `profiles`
# could not be imported ("No module named 'config'"). Add the folder that contains manage.py.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from django.core.wsgi import get_wsgi_application  # noqa: E402

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()
