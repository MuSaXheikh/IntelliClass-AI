# Technical Architecture: IntelliClass AI

**Version:** 1.0 | **Style:** Service-oriented, containerised, privacy-first (edge inference)

---

## 1. System Overview & High-Level Architecture

IntelliClass AI is a web-based virtual classroom with an AI layer on top. Two design principles drive every decision:

1. **Edge-first vision:** Face analysis runs inside the student's browser (MediaPipe). Raw video never leaves the device; only a few bytes/second of numeric features are sent.
2. **No single-frame decisions:** The Alert Engine combines *confidence + persistence + cooldown + grouping* so blinks and brief glances never create alarms.

### 1.1 Layered Block Diagram

```
┌───────────────────────────────┐   ┌───────────────────────────────┐
│  STUDENT BROWSER (Next.js)    │   │  INSTRUCTOR BROWSER (Next.js) │
│  Camera/mic/screen (consent)  │   │  Create class, upload slides  │
│  MediaPipe Face Mesh (EAR,    │   │  Live video + slide delivery  │
│  head pose, gaze)             │   │  Alert dashboard, analytics,  │
│  Screen frame sampling +      │   │  AI assistant                 │
│  change detection             │   │                               │
└──────────┬────────────────────┘   └───────────────┬───────────────┘
           │ media + event features                 │ HTTPS / WSS
┌──────────▼────────────────────┐   ┌───────────────▼───────────────┐
│  REAL-TIME LAYER              │──▶│  APPLICATION API (FastAPI)    │
│  WebRTC via SFU (LiveKit)     │   │  JWT auth + RBAC, classes,    │
│  Secure WebSocket channel     │   │  roll numbers, REST + WS      │
└──────────┬────────────────────┘   └──┬──────────┬──────────┬──────┘
           │                  sampled  │          │ lecture  │
           │                  frames   │          │ audio    │
┌──────────▼───────────┐ ┌────────────▼───┐ ┌─────▼──────────────────┐
│ Vision Event Service │ │ Screen         │ │ Audio, NLP & GenAI     │
│ Temporal smoothing,  │ │ Compliance     │ │ faster-whisper, topics,│
│ drowsiness classifier│ │ PaddleOCR,     │ │ summary, RAG assistant │
│ attention states     │ │ CLIP/SBERT     │ │ (pgvector), reports    │
└──────────┬───────────┘ └───────┬────────┘ └────────┬───────────────┘
           └─────────────┬───────┴───────────────────┘
              ┌──────────▼───────────────────┐
              │ INTELLIGENT ALERT ENGINE     │──── live alerts (WebSocket) ──▶ Instructor Dashboard
              │ thresholds, cooldown, group, │
              │ severity ranking, nudge      │
              └──────────┬───────────────────┘
              ┌──────────▼───────────────────┐
              │ DATA LAYER                   │
              │ PostgreSQL + pgvector (users,│
              │ classes, events, transcripts,│
              │ embeddings) | Redis pub/sub  │
              │ Object storage: slides only  │
              └──────────────────────────────┘
```

> **Privacy guarantee:** The data layer stores structured data only. No raw video or screen recordings are ever stored.

---

## 2. Tech Stack

| Layer | Technology | Notes (all free / open-source) |
|-------|-----------|--------------------------------|
| **Frontend** | Next.js, React, TypeScript, Tailwind CSS | Deployed on Vercel Hobby (`intelliclass-ai.vercel.app`) |
| **Backend** | Python, FastAPI, Pydantic | REST + WebSocket endpoints |
| **Real-time** | WebRTC via LiveKit Cloud free tier (SFU + TURN), WebSocket, Redis pub/sub | SFU scales better than peer-to-peer |
| **Computer Vision** | MediaPipe (browser), OpenCV, PyTorch | Face Mesh 468 landmarks; PyTorch for learned classifier |
| **OCR / Similarity** | PaddleOCR, CLIP, Sentence-BERT | Open-source models |
| **Speech-to-Text** | faster-whisper (Whisper small/base, CPU) | No paid API |
| **LLM / RAG** | Llama 3.2 3B or Qwen2.5 3B via Ollama / HF Spaces; Groq free tier for speed | Grounded answers only |
| **Database** | Supabase free tier (PostgreSQL + pgvector), Upstash free tier (Redis) | Persistent storage off HF Spaces |
| **Cloud / Hosting** | Vercel (frontend); Hugging Face Spaces (Docker, FastAPI + AI services) | HF Spaces storage not permanent, so data lives in Supabase/Upstash |
| **DevOps** | Docker, Docker Compose, Nginx, Let's Encrypt, GitHub Actions | CI/CD |
| **Testing** | PyTest, Vitest, Playwright, k6 / Locust | Unit, E2E, load |
| **Model Training** | Google Colab, Kaggle Notebooks (free GPU) | MRL Eye, YawDD, DAiSEE datasets |
| **Other** | Git/GitHub (Student Developer Pack), VS Code, Figma | |

---

## 3. Data Flow & System Interactions

### 3.1 Drowsiness / Attention Flow (Objective 1)
1. Student webcam frames sampled at **5–10 fps** in the browser.
2. MediaPipe Face Mesh extracts 468 landmarks (flags face absent / multi-face).
3. Feature extraction: **EAR, blink rate, PERCLOS, head pose, gaze angle**.
4. Numeric features (few bytes/second) sent over secure WebSocket.
5. **Temporal classifier** (server, sliding window; rule-based EAR baseline vs. learned model) outputs state: `attentive | sleepy | looking_away | no_face | uncertain`.
6. Event (type, confidence, duration, student ID, timestamp) → Alert Engine.

### 3.2 Screen Compliance Flow (Objective 2)
1. Shared screen sampled every few seconds.
2. **Perceptual-hash filter** drops unchanged frames.
3. Changed frames → OCR (PaddleOCR) + image/text embeddings (CLIP, Sentence-BERT).
4. Compare with embedding of instructor's current slide and neighbours.
5. Low similarity must persist beyond **grace period** before a `wrong_screen` event is created.

### 3.3 Alert Engine Flow (Objective 3)
```
Incoming Event → Confidence > threshold? ─no→ Ignored/Merged
                       │yes
                 Persists > duration? ─no→ Ignored/Merged
                       │yes
                 Outside cooldown? ─no→ Ignored/Merged
                       │yes
              Alert on Instructor Dashboard (ranked by severity, grouped)
                       │ instructor taps alert
              Private Nudge → ONE student's session ID (sound + message, rate-limited, audit-logged)
                       │
              Student replies "I am back" / "Connection problem" → stored as alert feedback
```

### 3.4 Lecture Intelligence Flow
`Lecture audio → faster-whisper (live transcript) → NLP (topic segmentation, summary, key points, likely questions) → embed slide + transcript chunks → pgvector → semantic retrieval (this lecture only) → open-source LLM → grounded answer with source slide, or "not covered".`

### 3.5 Key Interaction Summary

| From | To | Channel | Payload |
|------|----|---------|---------|
| Student browser | Vision Event Service | WSS | Numeric features only |
| Student browser | Screen Compliance | HTTPS/WSS | Sampled (changed) screen frames, processed transiently, not stored |
| Instructor/Student | LiveKit SFU | WebRTC | Audio/video media |
| Instructor audio | Audio/NLP service | Stream/chunks | Lecture audio |
| Alert Engine | Instructor dashboard | WSS (Redis pub/sub) | Prioritised alerts |
| Instructor | Single student | WSS (by session ID) | Nudge message + sound |

> **Design decision to confirm in implementation:** Screen frames must reach a server-side OCR/embedding service in the baseline design. To uphold "no screenshot stored," frames are processed in memory and discarded. A stricter option is to run lightweight OCR/embedding on-device and send only similarity scores. The team compares both as part of the *client-side vs. server-side inference* experiment.

---

## 4. Component Hierarchy

### 4.1 Frontend (Next.js)
```
App
├── Auth (Login, Register)
├── Instructor
│   ├── ClassManager (create class, enrol by roll no., upload slides)
│   ├── LiveClassRoom
│   │   ├── VideoStage (LiveKit)
│   │   ├── SlideController
│   │   ├── AlertDashboard (live list, severity, grouping)
│   │   │   └── NudgeButton
│   │   └── AssistantPanel
│   └── AnalyticsReport (post-class)
├── Student
│   ├── ConsentGate (signal notice + permissions)
│   ├── ClassRoom
│   │   ├── VideoStage, SlideViewer
│   │   ├── VisionWorker (MediaPipe, EAR/PERCLOS/pose/gaze)
│   │   ├── ScreenSampler (pHash change detection)
│   │   ├── NudgeReceiver (sound + message + one-tap reply)
│   │   └── AskLectureAssistant
│   └── MySummary (private attention/participation)
└── Shared (Layout, StatusBadge, Toasts, WebSocketProvider)
```

### 4.2 Backend (FastAPI)
```
app/
├── api/         (auth, classes, enrolment, slides, sessions, reports, nudge)
├── ws/          (event channel, alert channel, nudge routing)
├── services/
│   ├── vision_events/    (temporal smoothing, classifier)
│   ├── screen_compliance/ (pHash, OCR, embeddings, similarity)
│   ├── alert_engine/      (threshold, persistence, cooldown, grouping, severity)
│   ├── audio_nlp/         (faster-whisper, summariser, question generator)
│   └── rag/               (chunking, pgvector retrieval, LLM, grounding)
├── models/ schemas/ (SQLAlchemy / Pydantic)
├── core/    (config, security/JWT, RBAC, audit logging)
└── db/      (migrations, session)
```

---

## 5. Scalability, Performance & Security Architecture

### 5.1 Scalability
- **SFU (LiveKit)** instead of peer-to-peer: one upstream per participant, server forwards streams.
- **Edge inference** removes per-student video processing from the server; only bytes/second flow.
- **pHash change filter** cuts OCR/embedding workload for static screens.
- **Redis pub/sub** decouples event producers from dashboard consumers; stateless FastAPI workers can scale horizontally (Docker Compose, later multiple replicas).
- **Target:** stable at 10 / 25 / 50 / 100 concurrent users (k6/Locust).
- **Free-tier risks:** HF Spaces CPU limits and LiveKit free-tier quotas. Mitigate with small models (Whisper small/base, 3B LLM), batching, and load tests to find the ceiling early.

### 5.2 Performance Budget

| Path | Target |
|------|--------|
| Event → instructor alert | ≤ 3 s end to end |
| Vision loop (browser) | 5–10 fps without UI lag on i5/Ryzen 5 laptops |
| Screen sample interval | Every few seconds, skip unchanged frames |
| Transcript latency | Near-real-time (chunked) |

### 5.3 Security & Privacy
- **Authentication:** JWT; **authorisation:** role-based access control on every endpoint.
- **Transport:** HTTPS/WSS only (Vercel auto-HTTPS; Let's Encrypt for self-hosted Nginx).
- **Consent-gated capture:** camera, mic, screen require explicit permission; clear notice of what is analysed.
- **Data minimisation:** no video, photo, screenshot or screen recording stored/sent to instructor; slides only in object storage.
- **Nudge protection:** addressed to a single session ID, rate-limited, written to audit log (sender, receiver, time).
- **Audit log:** records who viewed student data.
- **Student rights:** each student sees only their own summary.
- **Ethics guard-rails:** supportive wording; "Uncertain" and "Connection problem" states prevent unfair flags; no cheating verdicts.
- **Secrets:** environment variables only; never committed.

### 5.4 Deployment Topology
```
Vercel (Next.js)  ──HTTPS/WSS──▶  Hugging Face Spaces (Docker: FastAPI + AI services)
LiveKit Cloud (WebRTC SFU)        Supabase (Postgres + pgvector)   Upstash (Redis)
GitHub Actions: lint → test → build → deploy
```
