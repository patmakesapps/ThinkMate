import type { RawTranscript, PolishedView, MeetingMeta } from "../types.js";

/**
 * The seam that turns a raw transcript into structured understanding.
 * Swappable like ASR: Claude today, anything tomorrow.
 */
export interface Polisher {
  readonly name: string;
  polish(raw: RawTranscript, meta?: MeetingMeta): Promise<PolishedView>;
}
