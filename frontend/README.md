# IntelliClass AI — Frontend

Next.js (App Router, TypeScript strict, Tailwind) client for instructors and students.

## Run

```bash
nvm use            # Node 22 (see ../.nvmrc)
pnpm install
cp .env.local.example .env.local
pnpm dev           # http://localhost:3000
```

Backend must be running on `http://localhost:8000` (see `../backend/README.md`).

## Scripts

| Script                                   | What it does                               |
| ---------------------------------------- | ------------------------------------------ |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js                                    |
| `pnpm lint`                              | ESLint (next/core-web-vitals + typescript) |
| `pnpm typecheck`                         | `next typegen && tsc --noEmit`             |
| `pnpm test`                              | Vitest unit tests in `tests/unit`          |
| `pnpm format`                            | Prettier                                   |

## Layout

```
src/
  app/            routes: /login, /register, /instructor/**, /student/**
  components/     ui/, layout/, auth/, classroom/, consent/
  hooks/          useSessionSocket, useVisionPipeline, useAuth, useToast, useAuthedImage
  lib/            api client, config, status map, vision maths (pure, tested)
  workers/        vision.worker.ts (MediaPipe Face Landmarker; numbers out, never pixels)
  types/          contract.ts (mirrors docs/memory.md §7)
tests/unit/       Vitest
```

## Privacy rule

The vision worker receives camera frames and posts **only numeric features** back. No frame,
bitmap or screenshot is ever posted out of the worker, sent over the network or stored.
