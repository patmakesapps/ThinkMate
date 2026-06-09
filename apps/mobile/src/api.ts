import { Platform } from "react-native";
import { BACKEND_URL } from "./config";
import type { MeetingResult, MeetingMeta } from "./types";

/**
 * Upload a recorded audio file to the backend and get back a MeetingResult.
 *
 * Native and web disagree on how to attach a file to FormData:
 *   - native: append a { uri, name, type } object (React Native special case).
 *   - web: the recording uri is a blob: URL, so fetch it into a real Blob.
 *
 * Note: the free Render instance sleeps when idle, so the first call after a
 * while can take ~50s to wake — callers should show a patient loading state.
 */
export async function processAudio(
  fileUri: string,
  meta?: MeetingMeta,
): Promise<MeetingResult> {
  const form = new FormData();

  if (Platform.OS === "web") {
    const blob = await (await fetch(fileUri)).blob();
    form.append("audio", blob, "recording.webm");
  } else {
    form.append("audio", {
      uri: fileUri,
      name: "recording.m4a",
      type: "audio/m4a",
      // RN's FormData file shape isn't in the DOM lib types.
    } as unknown as Blob);
  }

  if (meta) form.append("meta", JSON.stringify(meta));

  const res = await fetch(`${BACKEND_URL}/process`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error ?? "";
    } catch {
      // non-JSON error body
    }
    throw new Error(`Backend ${res.status}: ${detail || res.statusText}`);
  }

  return (await res.json()) as MeetingResult;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
