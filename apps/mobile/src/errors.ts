/**
 * One place to turn any thrown value into a clean, user-facing message.
 *
 * Errors reach the UI from a few sources — our own `throw new Error(...)`, the
 * network layer, the SQLite store, the OS share sheet — and not all of them are
 * `Error` instances. This normalizes them and maps the noisy low-level ones to
 * something a person can actually act on.
 */
export function toMessage(err: unknown, fallback = "Something went wrong."): string {
  const raw =
    err instanceof Error ? err.message :
    typeof err === "string" ? err :
    "";

  if (!raw) return fallback;

  // Network failures surface with a grab-bag of messages across platforms.
  if (/network request failed|failed to fetch|timed out|timeout/i.test(raw)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }

  // The free Render backend cold-starts; a 502/503 while it wakes is transient.
  if (/Backend 50[234]/i.test(raw)) {
    return "The server is waking up. Give it a few seconds and try again.";
  }

  return raw;
}
