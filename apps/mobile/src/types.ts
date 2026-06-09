/**
 * Mirror of the engine's MeetingResult contract (packages/engine/src/types.ts).
 *
 * The app intentionally keeps its own copy rather than importing the engine
 * package — the only thing crossing the wire is this JSON shape, so the app
 * stays a pure client with no Node/engine dependencies.
 */

export interface Speaker {
  id: string;
  label: string;
  name?: string;
}

export interface TranscriptSegment {
  speakerId: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface RawTranscript {
  speakers: Speaker[];
  segments: TranscriptSegment[];
  durationMs: number;
}

export interface ActionItem {
  text: string;
  ownerId?: string;
  owner?: string;
  due?: string;
}

export interface Decision {
  text: string;
  rationale?: string;
}

export interface OpenQuestion {
  text: string;
  raisedById?: string;
}

export interface Clarification {
  speakerId?: string;
  said: string;
  meant: string;
}

export interface PolishedView {
  tldr: string;
  decisions: Decision[];
  actionItems: ActionItem[];
  openQuestions: OpenQuestion[];
  clarifications: Clarification[];
}

export interface MeetingMeta {
  title?: string;
  attendees?: string[];
  context?: string;
}

export interface MeetingResult {
  id: string;
  meta?: MeetingMeta;
  createdAt: string;
  raw: RawTranscript;
  polished: PolishedView;
}
