import { randomUUID } from "node:crypto";
import type { ASRProvider } from "./asr/provider.js";
import type { Polisher } from "./polish/polisher.js";
import type { AudioInput, MeetingResult } from "./types.js";

export interface EngineOptions {
  asr: ASRProvider;
  polisher: Polisher;
  /**
   * The "flag" from the original idea: when a sink is attached, the engine
   * pushes its result onward (to a UI, a webhook, a queue). When absent, the
   * engine is a pure function: audio in, MeetingResult out.
   */
  sink?: (result: MeetingResult) => void | Promise<void>;
}

/**
 * ThinkMate engine. Vendor-agnostic, UI-agnostic.
 *
 *   audio --> [ASR: raw transcript] --> [Polisher: understanding] --> MeetingResult
 *
 * Both stages are injected, so this class never imports a vendor SDK.
 */
export class ThinkMateEngine {
  constructor(private readonly opts: EngineOptions) {}

  async process(audio: AudioInput): Promise<MeetingResult> {
    const raw = await this.opts.asr.transcribe(audio);
    const polished = await this.opts.polisher.polish(raw, audio.meta);

    const result: MeetingResult = {
      id: randomUUID(),
      meta: audio.meta,
      createdAt: new Date().toISOString(),
      raw,
      polished,
    };

    if (this.opts.sink) await this.opts.sink(result);
    return result;
  }
}
