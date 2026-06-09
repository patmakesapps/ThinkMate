/**
 * Live end-to-end run. No mocks, no canned data.
 *
 *   npm run demo -- "C:\path\to\recording.m4a"
 *
 * Requires (loaded from .env at repo root):
 *   DEEPGRAM_API_KEY   — real transcription + diarization
 *   ANTHROPIC_API_KEY  — real polished understanding
 *
 * Audio file: wav/mp3/m4a/etc. A quick voice memo or recorded call works.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ThinkMateEngine } from "./engine.js";
import { DeepgramASR } from "./asr/deepgram.js";
import { ClaudePolisher } from "./polish/claude.js";
import type { AudioInput, MeetingResult } from "./types.js";

const audioArg = process.argv[2];

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  console.error('Usage: npm run demo -- "C:\\path\\to\\recording.m4a"');
  console.error("Env:   DEEPGRAM_API_KEY and ANTHROPIC_API_KEY must be set in .env.\n");
  process.exit(1);
}

if (!audioArg) fail("No audio file given.");
const filePath = resolve(audioArg);
if (!existsSync(filePath)) fail(`Audio file not found: ${filePath}`);
if (!process.env.DEEPGRAM_API_KEY) fail("DEEPGRAM_API_KEY is not set.");
if (!process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY is not set.");

const engine = new ThinkMateEngine({
  asr: new DeepgramASR(),
  polisher: new ClaudePolisher(),
});

const audio: AudioInput = { filePath };

console.log(`\nProcessing: ${filePath}`);
console.log("Transcribing (Deepgram) → polishing (Claude)…\n");

const result = await engine.process(audio);
render(result);

function render(r: MeetingResult): void {
  const name = new Map(r.raw.speakers.map((s) => [s.id, s.name ?? s.label]));

  console.log("=".repeat(70));
  console.log(`RAW VIEW — ${r.raw.segments.length} segments, ${r.raw.speakers.length} speakers`);
  console.log("=".repeat(70));
  for (const s of r.raw.segments) {
    console.log(`\n${name.get(s.speakerId)}:`);
    console.log(`  ${s.text}`);
  }

  const p = r.polished;
  console.log("\n" + "=".repeat(70));
  console.log("POLISHED VIEW — what it actually means");
  console.log("=".repeat(70));
  console.log(`\nTL;DR\n  ${p.tldr}`);
  list("DECISIONS", p.decisions.map((d) => (d.rationale ? `${d.text}  (${d.rationale})` : d.text)));
  list(
    "ACTION ITEMS",
    p.actionItems.map((a) => {
      const who = a.ownerId ? name.get(a.ownerId) ?? a.ownerId : a.owner ?? "unassigned";
      return `[${who}] ${a.text}${a.due ? `  (due ${a.due})` : ""}`;
    }),
  );
  list("OPEN QUESTIONS", p.openQuestions.map((q) => q.text));
  list(
    "CLARIFICATIONS (said → meant)",
    p.clarifications.map(
      (c) => `${c.speakerId ? name.get(c.speakerId) + ": " : ""}"${c.said}"\n      → ${c.meant}`,
    ),
  );
  console.log("");
}

function list(title: string, items: string[]): void {
  console.log(`\n${title}`);
  if (items.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const it of items) console.log(`  • ${it}`);
}
