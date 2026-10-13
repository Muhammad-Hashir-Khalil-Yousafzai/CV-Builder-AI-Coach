# Free deployment (Vercel + Render + Supabase)

1. **Supabase**: SQL editor -> `create extension if not exists vector;` Copy the pooler host/user/password (port 6543).
2. **Render**: New -> Blueprint -> pick this repo (uses `render.yaml`). Fill the env vars (see `backend/backend/.env.example`).
   Then in the Render shell: `python manage.py reembed_jobs` (once) and `python manage.py sync_jobs`.
3. **Vercel**: import `frontend/frontend`, set `VITE_API_URL=https://<your-render-app>.onrender.com/api`.
   Put the Vercel URL into Render's `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, redeploy.
4. **Keep awake**: UptimeRobot (or cron-job.org) -> HTTP monitor on `https://<render-app>.onrender.com/health/?db=1` every 5-10 min.
   Optional backup: GitHub repo -> Settings -> Secrets -> `BACKEND_URL` = the Render URL (workflow `keepalive.yml`).
5. Test: login, job match, text coach, voice coach (HTTPS + production token path).

## Photo storage (Supabase Storage)
1. Supabase -> Storage -> New bucket -> name `cv-media`, turn **Public bucket** ON.
2. Storage -> Settings -> **S3 Connection** -> enable it, copy the endpoint + region, click **New access key** and copy the access key ID + secret (shown once).
3. Put these in Render: `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY`, `SUPABASE_S3_SECRET_KEY`, `SUPABASE_BUCKET=cv-media`,
   `SUPABASE_PUBLIC_BASE=https://<project-ref>.supabase.co/storage/v1/object/public/cv-media`. Redeploy, then upload a photo in My CV to test.
Photos uploaded before this change (on your computer) are not moved: upload them again.
