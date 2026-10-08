# UI/UX & Design Guidelines: IntelliClass AI

---

## 1. Design Philosophy & User Experience Goals

### 1.1 Principles
1. **Calm, not alarming.** Alerts are supportive nudges, never accusations. Wording: "may need attention", not "is cheating".
2. **Signals, not surveillance.** The UI never shows student faces/screens to the instructor, only a name, roll number and a short state.
3. **Quiet by default.** Few, prioritised alerts; colour and motion used sparingly.
4. **Honest about uncertainty.** "Uncertain" and "Connection problem" are first-class states with neutral styling.
5. **Transparent consent.** Students always see what is being analysed and can see it is on-device.
6. **Low cognitive load for instructors.** The instructor is speaking and presenting; the dashboard must be glanceable in < 2 seconds.

### 1.2 UX Goals

| Goal | Measure |
|------|---------|
| Instructor starts a class | ≤ 3 clicks |
| Student joins class | Login + roll number + consent, ≤ 1 minute |
| Instructor understands an alert | Glanceable in < 2 s |
| Nudge sent | 1 tap from alert |
| Student replies to nudge | 1 tap |
| Accessibility | WCAG AA contrast, keyboard navigable, no colour-only meaning |

---

## 2. Color Palette, Typography & UI Components

### 2.1 Colour Palette
Inspired by the University of Education logo (deep green + gold).

| Role | Name | Hex |
|------|------|-----|
| Primary | Deep Green | `#14532D` |
| Primary hover | Green 700 | `#166534` |
| Accent | Gold | `#FACC15` |
| Background | Off-white | `#F8FAFC` |
| Surface (cards) | White | `#FFFFFF` |
| Dark mode background | Slate 900 | `#0F172A` |
| Text primary | Slate 900 | `#0F172A` |
| Text secondary | Slate 600 | `#475569` |
| Border | Slate 200 | `#E2E8F0` |

### 2.2 Status Colours (Instructor Dashboard)
Always pair colour with an **icon and text label**.

| Status | Colour | Hex | Icon |
|--------|--------|-----|------|
| Attentive | Green | `#16A34A` | check-circle |
| Sleepy | Red | `#DC2626` | moon |
| Looking away | Amber | `#D97706` | eye-off |
| No face | Orange | `#EA580C` | user-x |
| Camera off | Slate | `#64748B` | video-off |
| Wrong screen | Purple | `#7C3AED` | monitor |
| Uncertain | Grey-blue | `#94A3B8` | help-circle |
| Connection problem | Blue | `#2563EB` | wifi-off |

Severity ranking (top of list first): Sleepy → No face → Wrong screen → Looking away → Camera off → Uncertain / Connection.

### 2.3 Typography

| Use | Font | Size / Weight |
|-----|------|---------------|
| Headings | Inter (or Poppins) | H1 28 / 700, H2 22 / 600, H3 18 / 600 |
| Body | Inter | 16 / 400 |
| Dashboard labels | Inter | 14 / 500 |
| Roll numbers / metrics | JetBrains Mono | 14 / 500 |
| Urdu text (transcripts) | Noto Nastaliq Urdu (fallback) | 16 / 400 |

### 2.4 UI Component Scheme (Tailwind + shadcn-style)

| Component | Spec |
|-----------|------|
| Buttons | Primary (green), Secondary (outline), Destructive (red), Ghost; 8 px radius; min 40 px height |
| Cards | White, 12 px radius, 1 px slate-200 border, subtle shadow |
| Status Badge | Pill with icon + label + status colour tint |
| Alert Row | Avatar initials, name, roll no., status badge, duration, **"Nudge"** button |
| Toast | Top-right; used for nudge sent / received |
| Modal | Consent gate, nudge composer, confirmation |
| Tables | Zebra rows, sticky header (analytics) |
| Charts | Recharts: line (attention timeline), bar (state distribution), heatmap (class engagement) |
| Slide Viewer | 16:9 canvas with prev/next (instructor), read-only synced (student) |
| Forms | Inline validation; labels above inputs |
| Dark mode | Supported via Tailwind `dark:` classes |

---

## 3. Wireframe / Screen Layout Descriptions

### Screen 1: Login / Register
- Centered card; logo top; Email/Roll No., Password; role toggle (Student / Instructor); link to register.

### Screen 2: Instructor Home (Class Manager)
- Left sidebar: Classes, Reports, Settings.
- Main: grid of class cards (name, enrolled count, next session) + **"Create Class"** button.
- Create Class modal: name, course code, enrol students (paste/upload roll numbers), upload slides (PDF/PPT).

### Screen 3: Student Home
- List of enrolled classes with **"Join"** (enabled when live), "My Summary" link, recent lecture notes.

### Screen 4: Consent Gate (Student, before joining)
```
┌──────────────────────────────────────────────┐
│  Before you join: what is analysed           │
│  ✔ Camera: eye state & face direction        │
│    (analysed ON YOUR DEVICE; no video sent)  │
│  ✔ Screen: compared with the current slide   │
│  ✔ Microphone: to take part in class         │
│  ✘ We never record or store video/screens    │
│  [ ] I understand and agree                  │
│  [Test camera]  [Allow & Join]  [Cancel]     │
└──────────────────────────────────────────────┘
```

### Screen 5: Instructor Live Classroom (core screen)
```
┌────────────────────────────────────┬─────────────────────────┐
│ Header: class name | timer | End   │                         │
├────────────────────────────────────┤  LIVE ALERTS (ranked)   │
│                                    │  ● Sleepy  – Ali (23)   │
│   Slide stage (16:9)               │      [Nudge]            │
│   + instructor video (small)       │  ● Wrong screen – Sana  │
│   [◀ Prev] [Next ▶] slide 5/20     │      [Nudge]            │
├────────────────────────────────────┤  Grouped: "Hamza ×3"    │
│ Class strip: 42 attentive · 3      ├─────────────────────────┤
│ looking away · 1 sleepy · 2 uncert.│  Students list (filter) │
│                                    │  Assistant tab          │
└────────────────────────────────────┴─────────────────────────┘
```
- Tapping **Nudge** opens a small popover (preset messages: "Please focus", "Are you there?", custom text) and confirms with a toast.

### Screen 6: Student Live Classroom
- Slide viewer (synced) + instructor video; small status chip: "Camera analysis: on-device ✔".
- Nudge overlay: gentle sound, banner "Message from Dr. Khan: Please rejoin", buttons **[I am back]** **[I have a connection problem]**.
- Tab: "Ask about this lecture" (RAG chat with source slide citations).

### Screen 7: Post-Class Report (Instructor)
- Summary cards (avg attention %, alerts raised, nudges sent, justified-alert rate).
- Attention timeline chart, state distribution, per-student table, lecture summary, key topics, likely questions.

### Screen 8: My Summary (Student, private)
- Personal attention %, participation, timeline, notes, lecture summaries. Only visible to that student.

### Screen 9: Lecture Notes & Assistant
- Summary, key points, likely questions; chat box that answers with a slide citation or "This was not covered in the lecture."

### Screen 10: Admin / Audit (optional)
- Audit log table: who viewed whose data, nudges (sender, receiver, time).

---

## 4. User Journey Maps & Key Workflows

### 4.1 Instructor Journey

| Stage | Action | Emotion | UI Support |
|-------|--------|---------|------------|
| Prepare | Create class, enrol rolls, upload slides | Neutral | Simple 3-step wizard |
| Start | Click "Start Live Class" | Confident | One button, device check |
| Teach | Present slides, speak | Focused | Dashboard is glanceable; no pop-ups |
| Notice | Alert arrives for sleepy student | Aware | Ranked, grouped, quiet badge |
| Act | Tap **Nudge** | In control | One tap, preset messages |
| Reflect | Read post-class report | Informed | Charts and summary |

### 4.2 Student Journey

| Stage | Action | Emotion | UI Support |
|-------|--------|---------|------------|
| Join | Login, read consent notice | Cautious | Plain-language privacy notice |
| Attend | Watch lecture, camera analysed on-device | Comfortable | Visible "on-device" chip |
| Nudged | Gentle sound + message | Mildly surprised | Private, non-shaming wording |
| Respond | Tap "I am back" | Relieved | One-tap reply |
| Revise | View summary, ask assistant | Supported | Grounded Q&A with slide references |

### 4.3 Key Workflows

**W1: Alert → Nudge → Feedback**
`Student drowsy > 5 s → Alert Engine passes thresholds → dashboard row → instructor taps Nudge → student gets sound + message (only them) → taps "I am back" → feedback saved, alert marked resolved/justified.`

**W2: Wrong Screen**
`Student switches to another window → similarity drops → persists past grace period → "Wrong screen" alert → instructor may nudge.`

**W3: Poor Conditions**
`Bad lighting → weak landmark confidence → state "Uncertain" (grey-blue, no alert) → optional student hint: "Improve lighting".`

**W4: Post-class Learning**
`Class ends → transcript + summary generated → student opens notes → asks question → answer with slide citation or "not covered".`

### 4.4 Copy & Tone Guidelines
- Use: "may need attention", "Are you still with us?", "Looks like you stepped away."
- Avoid: "caught", "cheating", "violation", "suspicious".
