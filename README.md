# ThinkMate

Turn confusing meetings into clear understanding.

People leave meetings unsure what was actually decided. ThinkMate listens to a
meeting and gives you two views:

- **Raw** — who said what (transcript with separated speakers).
- **Polished** — what it actually *means*: decisions, action items, open
  questions, and clarifications of things that were said unclearly.

## Architecture

The **engine** is deliberately separate from any UI. It takes audio in and
returns a structured `MeetingResult`. A UI, a Slack bot, or a phone app are all
just consumers of that result.

```
audio --> [ASR: raw transcript + speakers] --> [Polisher: understanding] --> MeetingResult
            (Deepgram, swappable)                (Claude, swappable)
```

Both stages sit behind interfaces (`ASRProvider`, `Polisher`), so vendors swap
out without touching consumers. Consumers depend only on `packages/engine/src/types.ts`.

## Run it (post-meeting, file-based v1)

1. Copy `.env.example` to `.env` and fill in:
   - `DEEPGRAM_API_KEY` — https://console.deepgram.com
   - `ANTHROPIC_API_KEY` — https://console.anthropic.com
2. Install and run on a real recording:

```bash
npm install
npm run demo -- "C:\path\to\recording.m4a"
```

Prints the Raw and Polished views to the terminal.

## Status

- [x] Engine: audio → raw transcript + diarization → polished understanding
- [x] Vendor-swappable ASR (Deepgram) and polisher (Claude)
- [x] Proven end-to-end on real audio
- [ ] Capture layer (browser mic → phone app)
- [ ] Web UI (Raw ⇄ Polished toggle)
