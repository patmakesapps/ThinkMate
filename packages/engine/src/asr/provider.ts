import type { AudioInput, RawTranscript } from "../types.js";

/**
 * The seam that makes the transcription vendor swappable.
 * Deepgram, AssemblyAI, Whisper, a mock — all implement this and nothing else.
 */
export interface ASRProvider {
  readonly name: string;
  transcribe(audio: AudioInput): Promise<RawTranscript>;
}
