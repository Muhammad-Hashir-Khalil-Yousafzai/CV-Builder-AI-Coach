# Free deployment, no card needed (Vercel + Vercel + Supabase)

Two Vercel projects from the same GitHub repo.

## 1. Backend (Django)
Vercel -> Add New -> Project -> pick the repo -> **Root Directory: `backend/backend`** (Framework: Django / Other).
Environment variables: copy from `backend/backend/.env.example`:
`SECRET_KEY`, `DEBUG=False`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT=6543`, `GEMINI_API_KEY`,
`CORS_ALLOWED_ORIGINS` (frontend URL, add after step 2). Deploy, then open `https://<backend>.vercel.app/health/?db=1` -> `{"status":"ok"}`.

## 2. Frontend (React)
New Project -> same repo -> **Root Directory: `frontend/frontend`** -> env `VITE_API_URL=https://<backend>.vercel.app/api`.
Then put the frontend URL into the backend's `CORS_ALLOWED_ORIGINS` and redeploy the backend.

## 3. Fill the database (from your computer, once)
Temporarily point your local `backend/backend/.env` at Supabase (pooler, port 6543), then:
`python manage.py migrate`, `python manage.py reembed_jobs`, `python manage.py sync_jobs`. Restore your local `.env` afterwards.
In the Supabase SQL editor run the row-level-security block.

## 4. Keep Supabase awake
GitHub repo -> Settings -> Secrets -> `BACKEND_URL` = `https://<backend>.vercel.app` (workflow `.github/workflows/keepalive.yml`, runs twice a day).
The backend itself never "sleeps" on Vercel, so no UptimeRobot is needed.

## Limits to know
- A request may run up to 60 s (`vercel.json`). Request bodies are limited to about 4.5 MB (big CV PDFs / photos may fail).
- The server disk is read-only: photo uploads need Supabase Storage (add the `SUPABASE_*` variables). Without it, photo upload fails; everything else works.
- Rate limits and the CV-embedding cache are per server instance (they reset on cold starts).
- Free plan is for personal, non-commercial use.

## Photo storage (Supabase Storage)
1. Supabase -> Storage -> New bucket `cv-media` (Public bucket ON).
2. Storage -> Settings -> S3 Connection -> enable, copy endpoint + region, create an access key.
3. Vercel (backend) env: `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY`, `SUPABASE_S3_SECRET_KEY`, `SUPABASE_BUCKET=cv-media`,
   `SUPABASE_PUBLIC_BASE=https://<project-ref>.supabase.co/storage/v1/object/public/cv-media`. Redeploy and test an upload.
