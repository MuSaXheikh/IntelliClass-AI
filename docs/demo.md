# Demo runbook (vertical slice, October 2026)

What this demo shows: an instructor starts a class, students join after consent, their browsers analyse the webcam on-device, the dashboard shows status signals, a persistent condition raises an alert, the instructor sends a private nudge, the student replies, and a report is produced. Nothing about a student ever leaves their device except numbers.

## 1. Start everything

```bash
# terminal 1
cd backend && uv run uvicorn app.main:app --port 8000
# terminal 2 (first time only: uv run python -m scripts.seed)
cd frontend && nvm use && pnpm dev
```

Open http://localhost:3000.

## 2. Instructor flow (browser window A)

1. Log in as `ayesha@demo.edu` / `Demo1234!`.
2. Open the class **Computer Vision 101** (6 students enrolled, 6 slides already uploaded).
3. Click **Start Live Class**. Show the empty roster and the slide stage. Use Prev/Next; mention every student's viewer follows.

## 3. Student flow (browser window B, or a laptop)

1. Log in as `hamza@demo.edu` / `Demo1234!`, click **Join**.
2. Show the **consent gate**: what is analysed, "analysed ON YOUR DEVICE", test camera, Allow & Join.
3. In window A the student appears as **Attentive**. Point out the chip "Camera analysis: on-device ✔" in window B.
4. Close your eyes for ~6 seconds. Window A: badge turns **Sleepy** after a few seconds, then an **alert** appears in the ranked panel. A blink or a 2-second glance does nothing.
5. Switch to another tab for ~25 seconds. Window A: **Wrong screen** alert (Page Visibility signal, no screenshot involved).

## 4. Fill the room without webcams (terminal 3)

```bash
cd backend && uv run python -m scripts.simulate_students --minutes 3
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

- LiveKit audio/video is wired for tokens but not configured; set the three LIVEKIT_* variables to enable the video stage.
- Screen-content similarity (OCR) is Phase 4; the wrong-screen signal is the visibility baseline (decision D14).
- Transcription, summaries and the RAG assistant are Phase 5.
