/**
 * ThinkMate core contracts.
 *
 * This file is the boundary between the ENGINE and everything that consumes it
 * (a UI, a Slack bot, an API). Consumers depend only on these shapes — never on
 * Deepgram, Claude, or any vendor. Swap a vendor, these types don't move.
 *
 * The product's two views map directly onto two fields of `MeetingResult`:
 *   - `raw`      -> the literal "who said what" transcript view
 *   - `polished` -> the "what they actually meant / what it means" view
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Audio handed to the engine. v1 is file-based (post-meeting). */
export interface AudioInput {
  /** Absolute path to an audio file (wav/mp3/m4a/etc). */
  filePath: string;
  /** Optional hints that improve transcription + downstream understanding. */
  meta?: MeetingMeta;
}

export interface MeetingMeta {
  title?: string;
  /** Names of attendees, if known. Helps label speakers later. */
  attendees?: string[];
  /** Free-text context: agenda, project, jargon glossary, etc. */
  context?: string;
}

// ---------------------------------------------------------------------------
// Speakers
// ---------------------------------------------------------------------------

export interface Speaker {
  /** Stable id within a meeting, e.g. "spk_0". */
  id: string;
  /** Display label. Starts as "Speaker 1"; may later map to a real name. */
  label: string;
  /** Resolved human name, once known/confirmed. */
  name?: string;
}

// ---------------------------------------------------------------------------
// Raw view
// ---------------------------------------------------------------------------

/** One contiguous utterance by a single speaker. */
export interface TranscriptSegment {
  speakerId: string;
  text: string;
  startMs: number;
  endMs: number;
  /** ASR confidence 0..1, if the provider reports it. */
  confidence?: number;
}

export interface RawTranscript {
  speakers: Speaker[];
  segments: TranscriptSegment[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Polished view — the actual product. Structured understanding, not prose.
// ---------------------------------------------------------------------------

export interface ActionItem {
  text: string;
  /** Speaker id of the likely owner, if attributable. */
  ownerId?: string;
  /** Free-text owner when no speaker maps cleanly (e.g. "the design team"). */
  owner?: string;
  due?: string;
}

export interface Decision {
  text: string;
  /** Short note on the rationale or context behind the decision. */
  rationale?: string;
}

export interface OpenQuestion {
  text: string;
  /** Who raised it, if attributable. */
  raisedById?: string;
}

/**
 * A point where what was *said* and what was *meant* diverged — the core
 * "I left the meeting confused" cure. Optional; only emitted when meaningful.
 */
export interface Clarification {
  /** Speaker id this clarifies. */
  speakerId?: string;
  /** A representative thing they said (may be paraphrased/condensed). */
  said: string;
  /** What they appear to actually mean. */
  meant: string;
}

export interface PolishedView {
  /** 2-4 sentence plain-language "if you read nothing else" summary. */
  tldr: string;
  decisions: Decision[];
  actionItems: ActionItem[];
  openQuestions: OpenQuestion[];
  clarifications: Clarification[];
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface MeetingResult {
  id: string;
  meta?: MeetingMeta;
  createdAt: string;
  raw: RawTranscript;
  polished: PolishedView;
}
