# Demo runbook (vertical slice, October 2026)

What this demo shows: an instructor starts a class, students join after consent, their browsers analyse the webcam on-device, the dashboard shows status signals, a persistent condition raises an alert, the instructor sends a private nudge, the student replies, and a report is produced. Nothing about a student ever leaves their device except numbers.

## 0. Prepare while you still have internet (once)

```bash
cd backend && supabase start && uv sync && cp .env.example .env   # set DATABASE_URL (DB_URL from `supabase status`, +psycopg) and a random JWT_SECRET
uv run alembic upgrade head && uv run python -m scripts.seed --instructor-email you@uni.edu --instructor-name "Your Name" --roster roster.csv
cd ../frontend && source ~/.nvm/nvm.sh && nvm use 22 && pnpm install && cp .env.local.example .env.local && pnpm build
```

After this, nothing below needs a connection: the API, the local Supabase database (Docker), the Swagger page, the MediaPipe model and WASM runtime (served from `frontend/public/`) and the fonts are all local. The only thing that needs internet is LiveKit audio/video, which the offline demo skips.

## 1. Start everything

```bash
# after a reboot, first: cd backend && supabase start
# terminal 1 (use --host 0.0.0.0 when a phone or second laptop will connect)
cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
# terminal 2 (production build, no internet needed)
cd frontend && source ~/.nvm/nvm.sh && nvm use 22 && pnpm start
```

Open http://localhost:3000 (API docs at http://localhost:8000/docs). For two logins on one laptop use a normal window plus an incognito window, or two browser profiles.

### Second laptop over a phone hotspot (no data needed)

1. On the demo laptop: `hostname -I` → e.g. `192.168.43.10`.
2. Leave `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` empty in `frontend/.env.local`: the app derives them from the page host, so no rebuild is needed. Start the backend with `--host 0.0.0.0` and allow ports 3000 and 8000 in the firewall (`sudo ufw allow 3000,8000/tcp`).
3. `backend/.env`: `ALLOWED_ORIGINS=http://localhost:3000,http://192.168.43.10:3000`.
4. On the student laptop open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://192.168.43.10:3000`, enable, relaunch. Browsers only allow the camera on HTTPS or localhost; this flag is the one-time exception for a LAN demo.
5. Open `http://192.168.43.10:3000` on the student laptop.

## 2. Instructor flow (browser window A)

1. Log in as the instructor you seeded (the seed printed the password once).
2. Open the class **Computer Vision 101** (6 students enrolled, 6 slides already uploaded).
3. Click **Start Live Class**. Show the empty roster and the slide stage. Use Prev/Next; mention every student's viewer follows.

## 3. Student flow (browser window B, or a laptop)

1. Log in as a student from your roster, click **Join**.
2. Show the **consent gate**: what is analysed, "analysed ON YOUR DEVICE", test camera, Allow & Join.
3. In window A the student appears as **Attentive**. Point out the chip "Camera analysis: on-device ✔" in window B.
4. Close your eyes for ~6 seconds. Window A: badge turns **Sleepy** after a few seconds, then an **alert** appears in the ranked panel. A blink or a 2-second glance does nothing.
5. Switch to another tab for ~25 seconds. Window A: **Wrong screen** alert (Page Visibility signal, no screenshot involved).

## 4. Fill the room without webcams (terminal 3)

```bash
cd backend && uv run python -m scripts.simulate_students --roster roster.csv --password <seed password> --minutes 3
```

Six scripted students connect: one falls asleep at 20 s, one looks away at 40 s, one switches tab at 30 s, one turns the camera off at 50 s, one drops the connection at 60 s. The dashboard ranks alerts by severity and groups repeats.

## 5. Private nudge

1. In window A click **Nudge** on Hamza's alert, choose "Are you still with us?".
2. Window B plays a gentle sound and shows the banner; nobody else sees anything (show another student window if available).
3. Click **I am back**. Window A: the alert is marked resolved; the audit log has a row for the nudge.

## 6. End class and report

Click **End class**. Open the report: attention %, alerts by type, nudges, justified-alert rate, per-student table. Log in as a student and open **My Summary**: only their own data.

## Talking points

- Two design decisions do the heavy lifting: on-device analysis (privacy, scale, free hosting) and confidence + persistence + cooldown alerting (no noise).
- Baseline first: today's classifier is rule-based (EAR/PERCLOS/head pose). The learned model (AI-03) must beat it with numbers.
- Everything shown is free-tier and open-source.

## Known gaps today

- LiveKit audio/video needs the three LIVEKIT_* variables in `backend/.env`; without them the video stage says "not configured" and everything else still works.
- Decks can be PDF, PowerPoint or ODP; PowerPoint needs LibreOffice on the backend machine. A deck cannot be changed while the class is live.
- A live class nobody is connected to ends itself after 45 minutes (`SESSION_IDLE_MINUTES`).
- Screen-content similarity (OCR) is Phase 4; the wrong-screen signal is the visibility baseline (decision D14).
- Transcription, summaries and the RAG assistant are Phase 5.
