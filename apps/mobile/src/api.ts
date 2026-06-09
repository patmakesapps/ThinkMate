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
 * The upload goes through XMLHttpRequest rather than fetch: as of Expo SDK 54+
 * the global `fetch` is Expo's WinterCG implementation, whose multipart encoder
 * rejects RN's { uri, name, type } file shape with "Unsupported FormDataPart
 * implementation". RN's XHR still encodes that shape natively, so it works on
 * both native and web with no extra native modules.
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

  const { status, statusText, body } = await xhrPost(`${BACKEND_URL}/process`, form);

  if (status < 200 || status >= 300) {
    let detail = "";
    try {
      detail = JSON.parse(body)?.error ?? "";
    } catch {
      // non-JSON error body
    }
    throw new Error(`Backend ${status}: ${detail || statusText}`);
  }

  return JSON.parse(body) as MeetingResult;
}

/** POST a FormData body via XMLHttpRequest, resolving with the raw response. */
function xhrPost(
  url: string,
  form: FormData,
): Promise<{ status: number; statusText: string; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    // Let the platform set multipart/form-data + boundary from the FormData body.
    xhr.onload = () =>
      resolve({ status: xhr.status, statusText: xhr.statusText, body: xhr.responseText });
    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.ontimeout = () => reject(new Error("Network request timed out"));
    xhr.send(form);
  });
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
