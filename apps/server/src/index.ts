/**
 * ThinkMate backend — stateless.
 *
 * Holds the Deepgram + Anthropic keys and runs the engine. Stores nothing:
 * meeting history lives on-device (SQLite) in the app. The only reason this
 * exists is so client apps never carry the API keys.
 *
 *   POST /process   multipart form, field "audio" = the recording
 *                   -> 200 MeetingResult (JSON)
 *   GET  /health    -> { ok: true }
 *
 * Run: npm run server   (from repo root; loads ../../.env)
 */
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { File } from "node:buffer";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  ThinkMateEngine,
  DeepgramASR,
  ClaudePolisher,
  type AudioInput,
} from "@thinkmate/engine";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✖ ${name} is not set. Put it in .env at the repo root.`);
    process.exit(1);
  }
  return v;
}
requireEnv("DEEPGRAM_API_KEY");
requireEnv("ANTHROPIC_API_KEY");

const engine = new ThinkMateEngine({
  asr: new DeepgramASR(),
  polisher: new ClaudePolisher(),
});

const app = new Hono();
app.use("/*", cors());

app.get("/health", (c) => c.json({ ok: true }));

app.post("/process", async (c) => {
  const body = await c.req.parseBody();
  const file = body["audio"];
  if (!(file instanceof File)) {
    return c.json({ error: "Expected multipart field 'audio' with a file." }, 400);
  }

  // Optional meeting metadata, sent as JSON in a "meta" field.
  let meta: AudioInput["meta"];
  const metaRaw = body["meta"];
  if (typeof metaRaw === "string" && metaRaw.trim()) {
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      return c.json({ error: "Field 'meta' must be valid JSON." }, 400);
    }
  }

  const dir = await mkdtemp(join(tmpdir(), "thinkmate-"));
  const tmpPath = join(dir, file.name || "audio");
  await writeFile(tmpPath, Buffer.from(await file.arrayBuffer()));

  try {
    const result = await engine.process({ filePath: tmpPath, meta });
    return c.json(result);
  } catch (err) {
    console.error("process failed:", err);
    return c.json({ error: (err as Error).message ?? "processing failed" }, 500);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\nThinkMate server listening on http://localhost:${info.port}`);
  console.log("  GET  /health");
  console.log("  POST /process  (multipart: audio=<file>, meta=<json?>)\n");
});
