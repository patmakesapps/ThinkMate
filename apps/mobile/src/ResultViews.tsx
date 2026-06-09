import { StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "./theme";
import type { MeetingResult } from "./types";

function speakerNames(result: MeetingResult): Map<string, string> {
  return new Map(result.raw.speakers.map((s) => [s.id, s.name ?? s.label]));
}

function mmss(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function RawView({ result }: { result: MeetingResult }) {
  const names = speakerNames(result);
  return (
    <View style={{ gap: space.md }}>
      {result.raw.segments.map((seg, i) => (
        <View key={i} style={raw.row}>
          <Text style={raw.time}>{mmss(seg.startMs)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={raw.speaker}>{names.get(seg.speakerId) ?? seg.speakerId}</Text>
            <Text style={raw.text}>{seg.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const raw = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md },
  time: { color: colors.textFaint, fontSize: 12, width: 44, paddingTop: 2, fontVariant: ["tabular-nums"] },
  speaker: { color: colors.accent, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={pol.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <View style={pol.item}>
      <View style={pol.check}>
        <Text style={pol.checkMark}>✓</Text>
      </View>
      <Text style={pol.itemText}>{children}</Text>
    </View>
  );
}

export function PolishedView({ result }: { result: MeetingResult }) {
  const names = speakerNames(result);
  const p = result.polished;
  const who = (id?: string, fallback?: string) =>
    id ? names.get(id) ?? id : fallback ?? "Unassigned";

  return (
    <View>
      <View style={pol.tldrCard}>
        <Text style={pol.tldrLabel}>TL;DR</Text>
        <Text style={pol.tldrText}>{p.tldr}</Text>
      </View>

      {p.decisions.length > 0 && (
        <Section title="Decisions">
          {p.decisions.map((d, i) => (
            <CheckItem key={i}>
              {d.text}
              {d.rationale ? <Text style={pol.sub}>{"  — " + d.rationale}</Text> : null}
            </CheckItem>
          ))}
        </Section>
      )}

      {p.actionItems.length > 0 && (
        <Section title="Action Items">
          {p.actionItems.map((a, i) => (
            <CheckItem key={i}>
              <Text style={pol.owner}>{who(a.ownerId, a.owner)}</Text>
              {"  " + a.text}
              {a.due ? <Text style={pol.sub}>{"  (" + a.due + ")"}</Text> : null}
            </CheckItem>
          ))}
        </Section>
      )}

      {p.openQuestions.length > 0 && (
        <Section title="Open Questions">
          {p.openQuestions.map((q, i) => (
            <CheckItem key={i}>{q.text}</CheckItem>
          ))}
        </Section>
      )}

      {p.clarifications.length > 0 && (
        <Section title="Clarifications">
          {p.clarifications.map((c, i) => (
            <View key={i} style={pol.clar}>
              <Text style={pol.clarSaid}>
                {c.speakerId ? names.get(c.speakerId) + ': ' : ''}“{c.said}”
              </Text>
              <Text style={pol.clarMeant}>→ {c.meant}</Text>
            </View>
          ))}
        </Section>
      )}
    </View>
  );
}

const pol = StyleSheet.create({
  tldrCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.lg,
  },
  tldrLabel: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  tldrText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: space.sm,
  },
  item: { flexDirection: "row", gap: space.sm, marginBottom: space.sm, alignItems: "flex-start" },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.good,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkMark: { color: colors.good, fontSize: 12, fontWeight: "900" },
  itemText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 21 },
  owner: { color: colors.accent, fontWeight: "700" },
  sub: { color: colors.textMuted },
  clar: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.sm,
  },
  clarSaid: { color: colors.textMuted, fontSize: 14, fontStyle: "italic", marginBottom: 6 },
  clarMeant: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
