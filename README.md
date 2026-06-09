# ThinkMate

Turn confusing meetings into clear understanding.

People leave meetings unsure what was actually decided. ThinkMate records a
meeting and gives you two views:

- **Raw** — who said what (transcript with separated speakers).
- **Polished** — what it actually *means*: a TL;DR plus decisions, action items,
  open questions, and clarifications of things that were said unclearly.

The differentiation lives in the **polished** view. Transcription and speaker
separation are rented commodities (Deepgram); the understanding layer is the
product (Claude). *Rent the ears, build the brain.*

---

## Architecture

The **engine** is deliberately separate from any UI. It takes audio in and
returns a structured `MeetingResult`. The phone app, a future web app, a Slack
bot — all are just consumers of that JSON contract.

```
                          ┌────────────────────────────────────────────┐
  audio (m4a/wav/…)  ───▶  │  ENGINE                                      │
                          │   ASR (Deepgram, swappable)  → raw transcript │
                          │   Polisher (Claude, swappable) → understanding│
                          └────────────────────────────────────────────┘
                                          │  MeetingResult (JSON)
                                          ▼
        ┌───────────────────────┐   ┌──────────────────────────────┐
        │  Backend (stateless)  │   │  App (Expo: iOS / web)        │
        │  holds the API keys   │◀──│  records audio, renders views │
        │  runs the engine      │──▶│  history in on-device SQLite  │
        └───────────────────────┘   └──────────────────────────────┘
```

- Consumers depend only on the contract in `packages/engine/src/types.ts`.
- ASR and the polisher each sit behind an interface (`ASRProvider`, `Polisher`),
  so vendors swap without touching consumers.
- The **app never holds API keys** — it calls the backend, which holds them.
- Meetings stay **on-device** (SQLite). Only the audio leaves the phone, to be
  processed; nothing is stored server-side.

### Repo layout

```
packages/engine    @thinkmate/engine — audio → raw + polished. UI-agnostic core.
apps/server        @thinkmate/server — stateless Hono API (POST /process). Deployed to Render.
apps/mobile        Expo app (React Native, SDK 56). Standalone; not part of the npm workspace.
```

`packages/*` and `apps/server` are an npm workspace. `apps/mobile` is a
standalone Expo project (React Native and workspace hoisting don't mix), so it
has its own `node_modules` and is installed separately.

---

## Setup

Requires Node 22+.

```bash
npm install                 # installs engine + server (the workspace)
cp .env.example .env        # then fill in the two keys
```

`.env` (gitignored — never committed):

```
DEEPGRAM_API_KEY=   # https://console.deepgram.com  (transcription + diarization)
ANTHROPIC_API_KEY=  # https://console.anthropic.com (polished understanding)
```

---

## Running each piece

### Engine, on a file (quickest sanity check)

```bash
npm run demo -- "C:\path\to\recording.m4a"
```

Prints the Raw and Polished views to the terminal.

### Backend API (local)

```bash
npm run server        # http://localhost:8787
# GET  /health    -> { "ok": true }
# POST /process   -> multipart: audio=<file>, meta=<json?>  ->  MeetingResult
```

The deployed instance lives at **https://thinkmate-ahpg.onrender.com** (Render
free tier — sleeps when idle, so the first request after a nap takes ~50s).

### App (Expo)

```bash
cd apps/mobile
npm install
npm run start         # then scan the QR with Expo Go, or use a dev build (below)
```

The backend URL the app talks to is the single config value in
`apps/mobile/src/config.ts`.

---

## Deployment (backend → Render)

`render.yaml` is a Render blueprint. Either deploy it as a Blueprint, or create
a Web Service from the repo with:

- **Root Directory:** _(blank — build/start run from the repo root)_
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Env vars:** `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY` (set in the dashboard)
- **Health Check Path:** `/health`

Auto-deploys on every push to `main`.

---

## Mobile dev build (testing on a real iPhone)

For hot-reload testing on-device without App Store Connect, use an EAS
**development build**:

```bash
cd apps/mobile
npm install -g eas-cli      # if not installed
eas login                   # your Expo/EAS account
eas device:create           # register your iPhone (ad-hoc provisioning)
eas build --profile development --platform ios
# install the build on the phone from the EAS link, then:
npx expo start --dev-client # hot reload against the installed dev build
```

App Store Connect / TestFlight is only needed later for distribution.

---

## Status

- [x] Engine: audio → raw transcript + diarization → polished understanding
- [x] Vendor-swappable ASR (Deepgram) and polisher (Claude)
- [x] Stateless backend, deployed to Render, verified end-to-end on real audio
- [x] Expo app: record → process, Raw|Polished views, on-device SQLite history
- [ ] On-device dev build + testing
- [ ] Web testing
- [ ] Multi-speaker diarization validation
- [ ] Live streaming; accounts / cross-device sync
