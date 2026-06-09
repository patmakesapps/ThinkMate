import { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, space } from "./theme";
import { ConfirmDialog } from "./components";
import {
  clearAllMeetings,
  deleteMeeting,
  listMeetings,
  subscribeMeetings,
  type MeetingRow,
} from "./db";
import { PRIVACY_POLICY_URL } from "./config";
import { toMessage } from "./errors";
import type { MeetingResult } from "./types";

// What the confirm dialog is currently asking about: one row, or clear-all.
type Pending = { kind: "one"; row: MeetingRow } | { kind: "all" } | null;

export function HistoryScreen({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (r: MeetingResult) => void;
}) {
  const [rows, setRows] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending>(null);

  const refresh = useCallback(async () => {
    try {
      setError("");
      setRows(await listMeetings());
    } catch (err) {
      setError(toMessage(err, "Couldn't load your history."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Re-read whenever the store changes (e.g. a delete from anywhere).
    return subscribeMeetings(refresh);
  }, [refresh]);

  async function runPending() {
    const job = pending;
    setPending(null);
    if (!job) return;
    try {
      if (job.kind === "one") await deleteMeeting(job.row.id);
      else await clearAllMeetings();
      // subscribeMeetings → refresh() updates the list; this is a fallback.
      await refresh();
    } catch (err) {
      setError(toMessage(err, "Couldn't delete. Please try again."));
    }
  }

  async function openPrivacy() {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      setError("Couldn't open the privacy policy.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>History</Text>
        <Pressable
          onPress={() => rows.length > 0 && setPending({ kind: "all" })}
          hitSlop={12}
        >
          <Text style={[styles.clear, rows.length === 0 && { opacity: 0.3 }]}>Clear</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.sm }}>
        {loading ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>No meetings yet.</Text>
            <Text style={styles.emptySub}>Recorded meetings are saved here, on this device only.</Text>
          </View>
        ) : (
          rows.map((row) => (
            <Pressable key={row.id} style={styles.card} onPress={() => onOpen(row.result)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {row.title ?? "Meeting"}
                </Text>
                <Text style={styles.cardSub} numberOfLines={2}>
                  {row.result.polished.tldr}
                </Text>
              </View>
              <Pressable
                onPress={() => setPending({ kind: "one", row })}
                hitSlop={10}
                style={styles.del}
              >
                <Text style={styles.delText}>✕</Text>
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable onPress={openPrivacy} style={styles.privacy} hitSlop={8}>
        <Text style={styles.privacyText}>Privacy Policy</Text>
      </Pressable>

      <ConfirmDialog
        visible={pending !== null}
        title={pending?.kind === "all" ? "Clear all history?" : "Delete meeting?"}
        message={
          pending?.kind === "all"
            ? "This permanently deletes every saved meeting on this device. This can't be undone."
            : `"${pending?.row.title ?? "This meeting"}" will be permanently deleted from this device.`
        }
        confirmLabel={pending?.kind === "all" ? "Clear all" : "Delete"}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  close: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  clear: { color: colors.danger, fontSize: 15, fontWeight: "600" },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  cardSub: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  del: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  delText: { color: colors.textFaint, fontSize: 16 },
  emptyWrap: { alignItems: "center", marginTop: space.xl, gap: 6 },
  empty: { color: colors.textMuted, fontSize: 15, textAlign: "center" },
  emptySub: { color: colors.textFaint, fontSize: 13, textAlign: "center" },
  privacy: { alignItems: "center", paddingVertical: space.md },
  privacyText: { color: colors.textFaint, fontSize: 13, textDecorationLine: "underline" },
});
