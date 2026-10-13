# Wiring the `jobs` app into your project

## 1. Copy the folder
Drop this whole `jobs/` folder next to your `profiles/` app in the project root.

## 2. Install packages
```bash
pip install pgvector sentence-transformers requests
```
(`sentence-transformers` pulls in `torch` — first install is a few hundred MB, that's normal.)

## 3. Enable pgvector on your Postgres DB
Run once, directly in your DB (Supabase/Neon SQL editor, or `psql`):
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 4. settings.py
```python
INSTALLED_APPS = [
    ...
    "profiles",
    "jobs",
]
```

## 5. Root urls.py
```python
urlpatterns = [
    ...
    path("api/", include("jobs.urls")),
]
```

## 6. Migrate
```bash
python manage.py makemigrations jobs
python manage.py migrate
```

## 7. Pull in some jobs
```bash
python manage.py sync_jobs
```
First run will download the embedding model (~80MB) — expect it to take a minute or two. Check
Django admin afterwards to confirm `Job` rows have non-empty embeddings.

## 8. Test the match endpoint
With a logged-in user (JWT token from your existing auth):
```
GET /api/jobs/match/
GET /api/jobs/match/?is_remote=true&limit=5
```

## Notes
- The embedding model loads once per process (in `services.py` at import time) — not per request.
  On a free-tier host with ~512MB RAM this is the main thing to watch; if it OOMs, that's why.
- `distance__lt=0.7` in `match_jobs_for_cv()` is a starting threshold — loosen/tighten it once you
  see real match scores against your actual users' CVs.
- RemoteOK's API is unofficial and can change shape without notice — if `sync_jobs` starts erroring,
  check the response format first before assuming your code broke.
