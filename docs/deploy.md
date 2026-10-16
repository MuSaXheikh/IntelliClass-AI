# Deploy to the web (free tiers, no card)

Three hosted parts, all free: **Supabase** (PostgreSQL + the slide-image bucket), **Render** (the
FastAPI backend as a Docker container) and **Vercel** (the Next.js frontend). LiveKit Cloud is
already in use for video. Total time with the accounts ready: about 40 minutes, most of it waiting
for builds. Everything in this file is also what `render.yaml` and `frontend/vercel.json` encode.

Region: pick **Singapore** everywhere (closest to Lahore).

## 1. Supabase project (database + storage)

1. https://supabase.com → New project → name `intelliclass`, region Singapore, choose a database
   password and keep it.
2. **Project settings → Database → Connection string → "Session pooler"** (not "Direct": the
   direct host is IPv6-only, which Render cannot reach). Copy the URI, replace `[YOUR-PASSWORD]`,
   and change the prefix `postgresql://` to `postgresql+psycopg://`. This is `DATABASE_URL`.
3. **Project settings → API**: copy the Project URL (`SUPABASE_URL`) and the `service_role` key
   (`SUPABASE_SERVICE_KEY`). Never use the `anon` key for the backend and never put the
   service key in the frontend.
4. Nothing else: the backend creates the tables (migrations) and the private `slides` bucket on
   its first start.

## 2. Backend on Render

1. https://render.com → sign in with GitHub → **New → Blueprint** → pick `IntelliClass-AI`.
   Render reads `render.yaml` and asks for the secrets marked `sync: false`:
   `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ALLOWED_ORIGINS` (put
   `https://intelliclass-ai.vercel.app` for now; fix it in step 3 once you know the real one),
   `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (from `backend/.env`).
   `JWT_SECRET` is generated for you.
2. Apply. The first build takes 5–8 minutes (LibreOffice is in the image). The service URL looks
   like `https://intelliclass-api.onrender.com`; `https://intelliclass-api.onrender.com/healthz`
   must answer `{"status":"ok"}` and `/docs` shows the API.
3. Free-tier facts: the instance sleeps after 15 idle minutes and takes about a minute to wake
   (the first request of the day is slow); 512 MB RAM, enough for the demo, but convert very
   large PowerPoint decks to PDF before uploading.

## 3. Frontend on Vercel

1. https://vercel.com → sign in with GitHub → **Add New → Project** → import `IntelliClass-AI`.
2. **Root Directory**: `frontend`. Framework is detected as Next.js; keep the default commands.
3. **Environment variables** (Production):
   - `NEXT_PUBLIC_API_URL` = `https://intelliclass-api.onrender.com/api/v1`
   - `NEXT_PUBLIC_WS_URL` = `wss://intelliclass-api.onrender.com/ws`
   - `NEXT_PUBLIC_LIVEKIT_URL` = `wss://intelliclass-ai-xgvhr235.livekit.cloud`
4. Deploy. Note the production URL (e.g. `https://intelliclass-ai.vercel.app`), then go back to
   Render → the service → Environment → set `ALLOWED_ORIGINS` to exactly that origin and save
   (the service restarts). Without this step sign-in fails with a CORS error.

## 4. First accounts

Nobody is built in. Open the Vercel URL, **Register** an instructor, create a class, enrol
students by roll number after they register themselves, upload a deck, publish a schedule. To
seed the demo roster instead, from your laptop:

```bash
cd backend
DATABASE_URL='postgresql+psycopg://...pooler...' STORAGE_BACKEND=supabase SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_KEY=<service role> \
  uv run python -m scripts.seed --instructor-email you@uni.edu --instructor-name "Your Name" --roster roster.csv
```

HTTPS means phones no longer need the Chrome flag: the camera just works.

## 5. Updating

Push to `main`. Render and Vercel both redeploy automatically; the backend applies new
migrations on start. Rotate the LiveKit key from cloud.livekit.io when it has been shared.

## Checks after deploying

| Check | Expect |
|---|---|
| `https://<api>/healthz` | `{"status":"ok"}` |
| Register + sign in on the Vercel URL | lands on the class list |
| Upload a PDF deck | thumbnails appear (bucket created on first start) |
| Phone joins a live class | consent gate, camera prompt, badge on the dashboard |
| Download PDF report, schedule export | files download |

## If something fails

- **CORS error on sign-in**: `ALLOWED_ORIGINS` on Render must equal the Vercel origin, no path,
  no trailing slash.
- **Backend logs "could not connect"**: you used the Direct connection string; switch to the
  Session pooler one and keep the `+psycopg` prefix.
- **`STORAGE_UNAVAILABLE` on upload**: `SUPABASE_URL` or the service key is wrong, or the key is
  the anon key.
- **Socket shows "reconnecting" forever**: `NEXT_PUBLIC_WS_URL` must start with `wss://`.
