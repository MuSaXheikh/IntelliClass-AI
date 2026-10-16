# Starting everything on a laptop

One-time setup takes about 20 minutes; after that, starting the project is three commands. Linux
and macOS commands are shown; on Windows use WSL2.

## 0. Install once

| Tool | Why | Install |
|---|---|---|
| Docker | runs the local Supabase stack | https://docs.docker.com/get-docker/ |
| Supabase CLI | starts PostgreSQL + Storage locally | `npm i -g supabase` (or brew) |
| uv | Python 3.12 and the backend's packages | https://docs.astral.sh/uv/ |
| nvm + Node 22 + pnpm | the frontend | `nvm install 22 && corepack enable` |
| LibreOffice (optional) | PowerPoint deck uploads; PDFs work without it | `sudo apt install libreoffice-impress` |

```bash
git clone git@github.com:MuSaXheikh/IntelliClass-AI.git
cd IntelliClass-AI
```

## 1. Supabase (database + slide images)

```bash
cd backend
supabase start          # first run downloads images (~1.5 GB); later runs take ~20 s
supabase status         # prints DB_URL, API_URL, SERVICE_ROLE_KEY, STUDIO_URL
```

Studio (tables, bucket) is at http://127.0.0.1:54323. Only one Supabase project can run at a time
on a laptop: `supabase stop --project-id <other>` if another project holds the ports.

## 2. Backend (FastAPI on port 8000)

```bash
cd backend
uv sync                                  # creates .venv
cp .env.example .env                     # then edit .env:
#   DATABASE_URL  = DB_URL from `supabase status`, with the prefix postgresql+psycopg://
#   JWT_SECRET    = python3 -c "import secrets; print(secrets.token_urlsafe(48))"
#   STORAGE_BACKEND=supabase and SUPABASE_SERVICE_KEY=<SERVICE_ROLE_KEY>  (optional; local disk otherwise)
uv run alembic upgrade head              # creates the tables
uv run python -m scripts.seed --instructor-email you@uni.edu --instructor-name "Your Name" --roster roster.csv
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`roster.csv` is one student per line: `email,full_name,roll_no` (keep it out of git; it is
ignored). The seed prints a generated password once; pass `--password` to choose one. Check:
http://localhost:8000/healthz says ok and http://localhost:8000/docs shows the API.

## 3. LiveKit (optional live video)

1. https://cloud.livekit.io → project → Settings → Keys → create a key.
2. In `backend/.env`: `LIVEKIT_URL=wss://<project>.livekit.cloud`, `LIVEKIT_API_KEY`,
   `LIVEKIT_API_SECRET`. Restart the backend.
3. In `frontend/.env.local`: `NEXT_PUBLIC_LIVEKIT_URL=wss://<project>.livekit.cloud`.

Without these the video stage shows "not configured" and everything else works. The free plan is
5,000 participant-minutes a month.

## 4. Frontend (Next.js on port 3000)

```bash
cd frontend
nvm use 22
pnpm install                             # also copies the MediaPipe WASM into public/
cp .env.local.example .env.local         # leave API/WS empty: they follow the page host
pnpm dev                                 # development, with hot reload
# or, for a demo (faster, works offline):
pnpm build && pnpm exec next start -H 0.0.0.0 -p 3000
```

Open http://localhost:3000.

## 5. Use the project

1. Sign in as the seeded instructor (or Register one). Create a class, enrol students by roll
   number, upload a PDF or PowerPoint deck, publish dates on Schedule (upload the template).
2. **Students on phones** over the same Wi-Fi or your hotspot: find the laptop IP (`hostname -I`),
   allow the ports once (`sudo ufw allow 3000,8000/tcp`), and on the phone's Chrome open
   `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<ip>:3000`, enable,
   relaunch (browsers only allow the camera on HTTPS or localhost). Then open `http://<ip>:3000`.
3. Instructor: Start Live Class. Student: Join, read the consent notice, Allow & Join. The badge
   appears on the dashboard; eyes closed for a few seconds raises an alert; Nudge; the student
   replies I am back; End class; Download PDF.
4. No webcams around? After starting the class:
   `cd backend && uv run python -m scripts.simulate_students --roster roster.csv --password <seed password> --minutes 3`

## 6. Every day

```bash
cd backend && supabase start && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000   # terminal 1
cd frontend && nvm use 22 && pnpm dev                                                      # terminal 2
```

Stop with Ctrl+C in each terminal and `supabase stop` when you are done (data is kept).

## 7. Before you push

```bash
cd backend && uv run ruff check . && uv run black --check . && uv run mypy app scripts && uv run pytest -q
cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## 8. When something does not start

| Symptom | Fix |
|---|---|
| `address already in use` on 8000 or 3000 | `fuser -k 8000/tcp 3000/tcp` |
| `supabase start` fails on ports 5432x | another Supabase project is running: `supabase stop --project-id <name>` |
| Backend stops with "needs SUPABASE_URL and SUPABASE_SERVICE_KEY" | set them, or `STORAGE_BACKEND=local` |
| Backend: `JWT_SECRET must be a random string` | generate one (step 2) |
| Sign-in fails with a CORS error | add the page origin to `ALLOWED_ORIGINS` in `backend/.env` and restart |
| Phone cannot open the site | backend started without `--host 0.0.0.0`, or ports blocked by the firewall |
| Camera blocked on the phone | the Chrome flag in step 5.2, or use HTTPS (`docs/deploy.md`) |
| PowerPoint upload says the server cannot convert | install LibreOffice, or export the deck to PDF |

Hosting on the web instead of a laptop: `docs/deploy.md`.
