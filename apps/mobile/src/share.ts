import { Platform, Share } from "react-native";
import type { MeetingResult } from "./types";
import { toMessage } from "./errors";

/** Map speaker ids to display names, mirroring the result views. */
function speakerNames(result: MeetingResult): Map<string, string> {
  return new Map(result.raw.speakers.map((s) => [s.id, s.name ?? s.label]));
}

function mmss(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function header(result: MeetingResult): string {
  const title = result.meta?.title ?? "Meeting";
  return `${title}\n${"=".repeat(Math.min(title.length, 40))}`;
}

/** The full word-for-word transcript, as plain text. */
export function rawToText(result: MeetingResult): string {
  const names = speakerNames(result);
  const lines = result.raw.segments.map((seg) => {
    const who = names.get(seg.speakerId) ?? seg.speakerId;
    return `[${mmss(seg.startMs)}] ${who}: ${seg.text}`;
  });
  return `${header(result)}\n\nTranscript\n\n${lines.join("\n")}`;
}

/** The polished summary (TL;DR, decisions, action items, etc.), as plain text. */
export function polishedToText(result: MeetingResult): string {
  const names = speakerNames(result);
  const p = result.polished;
  const who = (id?: string, fallback?: string) =>
    id ? names.get(id) ?? id : fallback ?? "Unassigned";

  const parts: string[] = [header(result), "", `TL;DR\n${p.tldr}`];

  if (p.decisions.length) {
    parts.push(
      "\nDecisions\n" +
        p.decisions
          .map((d) => `• ${d.text}${d.rationale ? ` — ${d.rationale}` : ""}`)
          .join("\n"),
    );
  }
  if (p.actionItems.length) {
    parts.push(
      "\nAction Items\n" +
        p.actionItems
          .map(
            (a) =>
              `• ${who(a.ownerId, a.owner)}: ${a.text}${a.due ? ` (${a.due})` : ""}`,
          )
          .join("\n"),
    );
  }
  if (p.openQuestions.length) {
    parts.push("\nOpen Questions\n" + p.openQuestions.map((q) => `• ${q.text}`).join("\n"));
  }
  if (p.clarifications.length) {
    parts.push(
      "\nClarifications\n" +
        p.clarifications
          .map(
            (c) =>
              `• ${c.speakerId ? `${names.get(c.speakerId)}: ` : ""}"${c.said}" → ${c.meant}`,
          )
          .join("\n"),
    );
  }
  return parts.join("\n");
}

/**
 * Open the OS share sheet with the chosen view's text. From there the user can
 * Save to Files, Copy, Mail, Message, etc. Returns false (without throwing) when
 * sharing isn't available — e.g. on web — so callers can fall back gracefully.
 */
export async function shareMeeting(
  result: MeetingResult,
  view: "raw" | "polished",
): Promise<{ ok: boolean; error?: string }> {
  const message = view === "raw" ? rawToText(result) : polishedToText(result);
  const title = result.meta?.title ?? "Meeting";

  // RN's Share isn't implemented on web; offer the Web Share API there instead.
  if (Platform.OS === "web") {
    const nav = globalThis.navigator as Navigator & {
      share?: (data: { title?: string; text?: string }) => Promise<void>;
    };
    if (typeof nav?.share === "function") {
      try {
        await nav.share({ title, text: message });
        return { ok: true };
      } catch (err) {
        // The user dismissing the share sheet rejects too — treat as a no-op.
        if (err instanceof Error && err.name === "AbortError") return { ok: false };
        return { ok: false, error: toMessage(err, "Couldn't share the meeting.") };
      }
    }
    return { ok: false, error: "Sharing isn't supported in this browser." };
  }

  try {
    const res = await Share.share({ title, message });
    return { ok: res.action === Share.sharedAction };
  } catch (err) {
    return { ok: false, error: toMessage(err, "Couldn't share the meeting.") };
  }
}
