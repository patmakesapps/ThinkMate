import Anthropic from "@anthropic-ai/sdk";
import type { Polisher } from "./polisher.js";
import type { RawTranscript, PolishedView, MeetingMeta } from "../types.js";

/**
 * Claude-backed polisher. Produces the "what they actually meant" view as
 * structured data (not prose) via forced tool use, so output is always valid
 * against PolishedView.
 *
 * Default model: Sonnet 4.6 — strong reasoning at a price that suits running
 * over full meeting transcripts. Bump to Opus for the hardest extraction.
 */
export class ClaudePolisher implements Polisher {
  readonly name = "claude";
  private readonly client: Anthropic;

  constructor(
    apiKey = process.env.ANTHROPIC_API_KEY,
    private readonly model = "claude-sonnet-4-6",
  ) {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    this.client = new Anthropic({ apiKey });
  }

  async polish(raw: RawTranscript, meta?: MeetingMeta): Promise<PolishedView> {
    const transcript = renderTranscript(raw);
    const speakerList = raw.speakers
      .map((s) => `${s.id} = ${s.name ?? s.label}`)
      .join(", ");

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      tool_choice: { type: "tool", name: "emit_polished_view" },
      tools: [POLISHED_VIEW_TOOL],
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            meta?.title ? `Meeting: ${meta.title}` : null,
            meta?.context ? `Context: ${meta.context}` : null,
            `Speakers: ${speakerList}`,
            "",
            "Transcript:",
            transcript,
          ]
            .filter((l) => l !== null)
            .join("\n"),
        },
      ],
    });

    const block = response.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new Error("Claude did not return a polished view");
    }
    return block.input as PolishedView;
  }
}

function renderTranscript(raw: RawTranscript): string {
  const nameOf = new Map(
    raw.speakers.map((s) => [s.id, s.name ?? s.label] as const),
  );
  return raw.segments
    .map((s) => `[${nameOf.get(s.speakerId) ?? s.speakerId}] ${s.text}`)
    .join("\n");
}

const SYSTEM_PROMPT = `You are ThinkMate, an assistant that cures the "I left the meeting confused" problem.
You receive a raw meeting transcript with speaker labels. Produce a structured
understanding of what was ACTUALLY decided, what needs to happen, and what is
still unresolved — not a prettier transcript.

Principles:
- Be faithful. Never invent decisions or commitments that were not made.
- Prefer fewer, high-signal items over padding.
- Attribute action items and questions to a speaker id when clearly attributable; otherwise leave the owner unattributed.
- Use "clarifications" ONLY when a speaker's meaning was genuinely unclear, hedged, or buried — capture what they appear to truly mean. If everything was clear, return an empty list.
- Write in plain language a busy person can scan in seconds.`;

const POLISHED_VIEW_TOOL: Anthropic.Tool = {
  name: "emit_polished_view",
  description: "Emit the structured polished understanding of the meeting.",
  input_schema: {
    type: "object",
    properties: {
      tldr: {
        type: "string",
        description: "2-4 sentence plain-language summary; the one thing to read.",
      },
      decisions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["text"],
        },
      },
      actionItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            ownerId: {
              type: "string",
              description: "Speaker id (e.g. spk_0) of the owner, if attributable.",
            },
            owner: {
              type: "string",
              description: "Free-text owner when no speaker id maps cleanly.",
            },
            due: { type: "string" },
          },
          required: ["text"],
        },
      },
      openQuestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            raisedById: { type: "string" },
          },
          required: ["text"],
        },
      },
      clarifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            speakerId: { type: "string" },
            said: { type: "string" },
            meant: { type: "string" },
          },
          required: ["said", "meant"],
        },
      },
    },
    required: ["tldr", "decisions", "actionItems", "openQuestions", "clarifications"],
  },
};
