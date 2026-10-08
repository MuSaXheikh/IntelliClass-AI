# Product Requirements Document (PRD)

**Project:** Keeping Students Focused Online: An AI Virtual Classroom for Attention Monitoring and Learning Guidance (**IntelliClass AI**)
**Institution:** Department of Information Sciences, University of Education, Lahore
**Document Version:** 1.0 | **Date:** October 2026
**Project Duration:** ~39 weeks (October 2026 – June 2027)

---

## 1. Project Vision & Objectives

### 1.1 Vision
Restore the "reading the room" feedback that teachers lose in online classes. IntelliClass AI is a web-based virtual classroom that quietly notices when a student is sleepy, absent, looking away, or on the wrong screen, tells the instructor only when it really matters, and turns each lecture into notes and answers, **without ever recording or storing student video**.

### 1.2 Problem Statement (Summary)
- Zoom / Meet / Teams deliver lectures but understand nothing about student attention.
- Proctoring tools are exam-oriented, store full video and accuse students.
- Engagement research is accurate but offline and not integrated into a live teaching platform.
- Naive single-frame detection creates constant false alarms; streaming video to a server neither scales nor respects privacy.

### 1.3 Aim
Build an easy-to-use online classroom that detects sleepiness, distraction and screen mismatch in real time, sends few but trustworthy alerts, and helps students revise after class, all privacy-first.

### 1.4 Objectives (from proposal, with IDs)

| ID | Objective | Measurable Target |
|----|-----------|-------------------|
| O1 | Online classroom (create class, join by roll number, live audio/video, slides) | Working end-to-end session |
| O2 | Sleepy-student detection via on-device camera analysis | ≥ 85 / 100 test cases correct; drowsiness reported only after several seconds |
| O3 | Attention loss detection (looking away, no face) with an honest "uncertain" state | Uncertain state raised under poor light/angle |
| O4 | Screen vs. current-slide compliance check (with consent) | Mismatch reported only after grace period |
| O5 | Few, useful alerts (confidence + persistence + cooldown + grouping) | Alert reaches instructor ≤ 3 s; no alert for blinks or 2-second glances |
| O6 | Private one-to-one nudge from instructor to one student | Only the target student receives it; audit-logged |
| O7 | Live instructor dashboard + post-class report | Live ranked alerts; auto summary after class |
| O8 | Report with signals, not pictures | No image/video ever reaches instructor or server |
| O9 | Private per-student summary | Student sees only own data |
| O10 | Lecture → notes (STT, summary, key topics, likely questions, grounded Q&A) | Answers only from lecture; "not covered" when unsure |
| O11 | Privacy protection (on-device analysis, consent notice, audit of who viewed data) | No video/screen recording stored |
| O12 | Baseline first, then prove improvement | Baseline vs. improved metrics reported |
| O13 | Proper testing (own samples, up to 100 concurrent users, real user feedback) | Load tests at 10 / 25 / 50 / 100 users |

---

## 2. Target Audience & User Personas

### Persona 1: Instructor, "Dr. Ayesha Khan"
- **Role:** University lecturer, teaches 40–60 students online/hybrid.
- **Goals:** Know who is drifting without stopping her lecture; get a short, prioritised list; gently call a student back without embarrassment; get a class summary after.
- **Pain points:** Video tiles are too small; busy speaking and sharing slides; discovers problems only through poor assessment results.
- **Tech comfort:** Medium. Needs one-click flows.

### Persona 2: Student, "Hamza Ali" (BS IT, evening shift)
- **Role:** Attends from home on a laptop with a built-in webcam; sometimes unstable internet.
- **Goals:** Follow the lecture, revise later using summaries, ask questions from lecture content.
- **Concerns:** Privacy ("is my video being recorded?"), being unfairly flagged when internet drops or light is poor.
- **Needs:** Clear consent notice, private summary, one-tap replies to nudges ("I am back", "I have a connection problem").

### Persona 3: Administrator / HoD, "Prof. Imran"
- **Role:** Oversees classes and policy.
- **Goals:** Assurance that the system respects privacy, is not used to accuse students, and gives aggregate analytics.
- **Needs:** Audit logs, role-based access, class-level reports.

### Persona 4: Project Supervisor / Evaluator (secondary)
- Needs measurable evidence: precision, recall, F1, latency, load-test results, baseline-vs-improved comparisons.

---

## 3. Core Features & Functionalities

### 3.1 Functional Requirements

#### FR-A: Authentication & User Management
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-A1 | Instructors and students register/login with JWT authentication | High |
| FR-A2 | Role-based access control (Instructor, Student, Admin) on every endpoint | High |
| FR-A3 | Instructor creates classes and enrols students by roll number | High |
| FR-A4 | Instructor uploads lecture slides (PDF/PPT) before class | High |

#### FR-B: Virtual Classroom
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-B1 | Live audio/video via WebRTC through an SFU (LiveKit) | High |
| FR-B2 | Slide viewer synced to the instructor's current slide | High |
| FR-B3 | Pre-join consent screen listing exactly which signals are analysed; explicit camera, mic and screen permissions | High |
| FR-B4 | Secure WebSocket channel (Redis-backed) for events and alerts | High |
| FR-B5 | Connection-problem detection (dropped/unstable connection shown as "Connection problem", not "ignoring") | Medium |

#### FR-C: On-Device Vision (Drowsiness & Attention)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-C1 | Run MediaPipe Face Mesh in the browser at 5–10 fps (468 landmarks) | High |
| FR-C2 | Compute EAR, blink rate, PERCLOS, head pose, gaze direction on-device | High |
| FR-C3 | Send only numeric features/events (bytes/second) to server; never video | High |
| FR-C4 | Server-side temporal classifier over sliding window (rule-based EAR baseline vs. learned model) | High |
| FR-C5 | States: attentive, sleepy, looking away, no face, camera off, uncertain | High |
| FR-C6 | Detect face absent / multiple faces | Medium |

#### FR-D: Screen-Content Compliance
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-D1 | Sample shared screen every few seconds (with permission) | High |
| FR-D2 | Perceptual-hash filter skips unchanged frames | Medium |
| FR-D3 | OCR (PaddleOCR) + embeddings (CLIP, Sentence-BERT) compared with current slide and its neighbours | High |
| FR-D4 | Raise "Wrong screen" event only if low similarity persists beyond configurable grace period | High |

#### FR-E: Intelligent Alert Engine
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-E1 | Each event carries student ID, type, timestamp, confidence, duration, source module | High |
| FR-E2 | Alert only if confidence > threshold AND persistence > duration (e.g., drowsy > 5 s, looking away > 20 s) AND outside cooldown | High |
| FR-E3 | Group repeated events; rank by severity | High |
| FR-E4 | Thresholds tuned on a validation set and reported | High |
| FR-E5 | Private nudge: instructor taps alert → sound + short message to that student only; rate-limited; audit-logged | High |
| FR-E6 | Student one-tap replies ("I am back", "I have a connection problem") stored as alert feedback | Medium |

#### FR-F: Instructor Dashboard & Reporting
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-F1 | Live dashboard: name, roll number, short state (Table of 8 status signals) | High |
| FR-F2 | No video frame, photo or screenshot ever shown/stored | High |
| FR-F3 | Post-class analytics and automatic summary report | Medium |
| FR-F4 | Student private summary view (own attention/participation only) | Medium |
| FR-F5 | Audit log of who viewed a student's information | Medium |

#### FR-G: Lecture Transcription & Learning Guidance
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-G1 | Near-real-time transcription with Whisper via faster-whisper (English, optional Urdu mix) | Medium |
| FR-G2 | Topic segmentation, summary, key points, likely exam questions | Medium |
| FR-G3 | Embed slides and transcript chunks in pgvector | Medium |
| FR-G4 | RAG assistant answers only from that lecture, cites source slide, says "not covered" if unsure | Medium |

### 3.2 Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | Performance | Alert latency ≤ 3 s from condition persistence to instructor dashboard |
| NFR-2 | Scalability | Support up to 100 concurrent participants; evaluated at 10/25/50/100 |
| NFR-3 | Privacy | Zero raw video/screen recording stored or transmitted to instructor; only structured events |
| NFR-4 | Security | HTTPS/WSS everywhere, JWT, RBAC, rate-limited nudges, audit logs |
| NFR-5 | Accuracy | Drowsiness detection ≥ 85% on test cases; false-alert rate reported |
| NFR-6 | Reliability | Graceful degradation: missing/uncertain signals never produce accusations |
| NFR-7 | Usability | Instructor can start a class in ≤ 3 clicks; student joins with roll number |
| NFR-8 | Cost | Entire stack free-tier/open-source (Rs. 0 budget) |
| NFR-9 | Compatibility | Laptop/desktop with webcam; modern Chromium-based browser |
| NFR-10 | Ethics | Alerts are supportive, never labelling students as dishonest; final decisions remain with instructor |
| NFR-11 | Maintainability | Containerised services, CI pipeline, ≥ 70% unit-test coverage on core logic |

---

## 4. Scope of Work

### 4.1 In-Scope
- Web-based virtual classroom for live lectures (WebRTC/SFU).
- On-device vision: face presence, eye state, drowsiness, gaze and head direction.
- Screen-to-slide compliance checking.
- Confidence- and persistence-based alert engine with grouping and cooldown.
- Private one-to-one nudge from instructor to student.
- Instructor dashboard (live) + post-class analytics.
- Lecture transcription, summaries, grounded RAG assistant.
- Containerised deployment, evaluated with up to 100 concurrent participants.

### 4.2 Out-of-Scope
- Examination proctoring or any automatic cheating/misconduct decision.
- Administrative automation (quiz generation, exam hosting, timetable, fees); attendance is only a by-product.
- Emotion recognition and face-recognition-based identity verification.
- Recording/storing raw video or continuous screen recordings.
- OS-level screen locking or bypassing browser permission indicators.
- Full parity with commercial meeting apps (breakout rooms, whiteboard, cloud recording) and native mobile apps.

### 4.3 Assumptions
- Students use laptop/desktop with webcam and Chromium-based browser.
- Students explicitly consent to camera and screen sharing.
- Instructor uploads slides (PDF/PPT) before class.
- Internet is stable enough for video calls.
- Lectures mainly English, optionally mixed with Urdu.

### 4.4 Constraints
- Zero-cost stack (free tiers: Vercel, Hugging Face Spaces, LiveKit Cloud, Supabase, Upstash).
- Free CPU hosting limits heavy models; free GPU only for training (Colab/Kaggle).
- ~39-week timeline with a 3-member team.

---

## 5. Success Metrics & Milestones

### 5.1 Success Metrics (KPIs)

| Area | Metric | Target |
|------|--------|--------|
| Drowsiness / attention models | Accuracy, precision, recall, F1, confusion matrix | Accuracy ≥ 85%; learned model beats EAR baseline |
| Screen compliance | Precision, recall, F1, false-positive rate | Reported; FP rate minimised via grace period |
| Alert engine | Alert latency, false-alert rate, detection rate | Latency ≤ 3 s; no alerts for blinks/2-s glances |
| Private nudge | Delivery success and latency; zero leakage to others | 100% delivered only to target |
| Speech-to-text | Word Error Rate (WER) | Reported on own test lectures |
| Lecture assistant | Answer correctness, groundedness, retrieval relevance | "Not covered" when context insufficient |
| On-device vs. server inference | Latency, CPU, bandwidth per student | Comparison table in final report |
| Scalability | End-to-end latency and resource usage at 10/25/50/100 users | Stable at 100 users |
| User acceptance | Feedback from real teachers/students | Positive usability survey |

### 5.2 Milestones (from proposal Gantt)

| # | Milestone | Duration |
|---|-----------|----------|
| 1 | Requirement Analysis & Literature Review | 5 weeks |
| 2 | System Design (architecture, DB schema, UI mock-ups) | 4 weeks |
| 3 | Environment Setup, Auth & Roles | 3 weeks |
| 4 | Virtual Classroom (WebRTC/SFU, WebSocket, dashboards) | 6 weeks |
| 5 | Vision Module (face, eye, drowsiness, gaze; model training) | 9 weeks |
| 6 | Screen Compliance (sampling, OCR, slide matching) | 6 weeks |
| 7 | Alert Engine & Dashboard (thresholds, cooldown, nudge) | 5 weeks |
| 8 | Speech, NLP & RAG Assistant | 7 weeks |
| 9 | Integration & Deployment | 3 weeks |
| 10 | Testing & Evaluation | 5 weeks |
| 11 | Documentation & Final Demo | 4 weeks |

*Several milestones overlap; total ≈ 39 weeks.*

### 5.3 Expected Research Contributions
1. Real-time multi-signal engagement pipeline running on the student device, evaluated in a live classroom.
2. Original, consented screen-compliance dataset and evaluation protocol.
3. Confidence- and persistence-based alerting method measured by false-alert rate.
4. Experimental comparison of client-side vs. server-side inference (latency, bandwidth, scalability).
