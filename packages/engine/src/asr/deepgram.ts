import { readFile } from "node:fs/promises";
import { createClient } from "@deepgram/sdk";
import type { ASRProvider } from "./provider.js";
import type {
  AudioInput,
  RawTranscript,
  Speaker,
  TranscriptSegment,
} from "../types.js";

/**
 * Deepgram prerecorded transcription with diarization.
 *
 * We use the utterances output (speaker-segmented) to build our RawTranscript.
 * If Deepgram changes or we swap vendors, only this file moves.
 */
export class DeepgramASR implements ASRProvider {
  readonly name = "deepgram";
  private readonly client;

  constructor(apiKey = process.env.DEEPGRAM_API_KEY) {
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY is not set");
    }
    this.client = createClient(apiKey);
  }

  async transcribe(audio: AudioInput): Promise<RawTranscript> {
    const buffer = await readFile(audio.filePath);

    const { result, error } =
      await this.client.listen.prerecorded.transcribeFile(buffer, {
        model: "nova-3",
        diarize: true,
        utterances: true,
        punctuate: true,
        smart_format: true,
      });

    if (error) throw error;

    const utterances = result?.results?.utterances ?? [];
    const speakerIds = new Set<number>();
    const segments: TranscriptSegment[] = [];

    for (const u of utterances) {
      const spk = u.speaker ?? 0;
      speakerIds.add(spk);
      segments.push({
        speakerId: speakerId(spk),
        text: u.transcript,
        startMs: Math.round(u.start * 1000),
        endMs: Math.round(u.end * 1000),
        confidence: u.confidence,
      });
    }

    const speakers: Speaker[] = [...speakerIds]
      .sort((a, b) => a - b)
      .map((n) => ({ id: speakerId(n), label: `Speaker ${n + 1}` }));

    const durationMs = Math.round(
      (result?.metadata?.duration ?? lastEnd(segments) / 1000) * 1000,
    );

    return { speakers, segments, durationMs };
  }
}

function speakerId(n: number): string {
  return `spk_${n}`;
}

function lastEnd(segments: TranscriptSegment[]): number {
  return segments.length ? segments[segments.length - 1].endMs : 0;
}
