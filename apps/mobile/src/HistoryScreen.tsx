import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, space } from "./theme";
import { Button } from "./components";
import { clearAllMeetings, deleteMeeting, listMeetings, type MeetingRow } from "./db";
import type { MeetingResult } from "./types";

export function HistoryScreen({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (r: MeetingResult) => void;
}) {
  const [rows, setRows] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setRows(await listMeetings());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function confirmDelete(row: MeetingRow) {
    Alert.alert("Delete meeting?", row.title ?? "This meeting", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteMeeting(row.id);
          refresh();
        },
      },
    ]);
  }

  function confirmClear() {
    if (rows.length === 0) return;
    Alert.alert("Clear all history?", "This permanently deletes every saved meeting on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: async () => {
          await clearAllMeetings();
          refresh();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>History</Text>
        <Pressable onPress={confirmClear} hitSlop={12}>
          <Text style={[styles.clear, rows.length === 0 && { opacity: 0.3 }]}>Clear</Text>
        </Pressable>
      </View>

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
              <Pressable onPress={() => confirmDelete(row)} hitSlop={10} style={styles.del}>
                <Text style={styles.delText}>✕</Text>
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>
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
});
