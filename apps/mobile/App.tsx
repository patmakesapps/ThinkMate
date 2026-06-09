import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import { colors, space } from "./src/theme";
import { Button, ListeningDisc, Mark, Tabs } from "./src/components";
import { RawView, PolishedView } from "./src/ResultViews";
import { processAudio } from "./src/api";
import { meetingExists, saveMeeting, subscribeMeetings } from "./src/db";
import { shareMeeting } from "./src/share";
import { toMessage } from "./src/errors";
import { PRIVACY_POLICY_URL } from "./src/config";
import type { MeetingResult } from "./src/types";
import { HistoryScreen } from "./src/HistoryScreen";

type Phase = "idle" | "recording" | "paused" | "processing" | "result" | "error";

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Meeting title timestamp — date and time, no seconds. */
function meetingTimestamp(d = new Date()): string {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function App() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  useAudioRecorderState(recorder); // keep recorder state subscription alive

  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [tab, setTab] = useState<"raw" | "polished">("polished");
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep the open meeting in a ref so the store subscription can read the
  // latest value without re-subscribing on every render.
  const resultRef = useRef<MeetingResult | null>(null);
  resultRef.current = result;

  useEffect(() => {
    if (phase === "recording") {
      timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [phase]);

  // If the meeting currently on screen gets deleted (from History or a
  // clear-all), drop it immediately instead of showing a stale copy.
  useEffect(() => {
    return subscribeMeetings(async () => {
      const open = resultRef.current;
      if (open && !(await meetingExists(open.id))) {
        setResult(null);
        setPhase("idle");
      }
    });
  }, []);

  async function start() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Microphone needed",
          "ThinkMate needs microphone access to record the meeting. You can enable it in Settings.",
        );
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setElapsed(0);
      setPhase("recording");
    } catch (err) {
      setErrorMsg(toMessage(err, "Couldn't start recording."));
      setPhase("error");
    }
  }

  function pause() {
    recorder.pause();
    setPhase("paused");
  }

  function resume() {
    recorder.record();
    setPhase("recording");
  }

  async function stopAndProcess() {
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch (err) {
      setErrorMsg(toMessage(err, "Couldn't stop the recording."));
      setPhase("error");
      return;
    }
    if (!uri) {
      setErrorMsg("No audio was captured. Please try recording again.");
      setPhase("error");
      return;
    }

    setPhase("processing");
    try {
      const meta = { title: `Meeting · ${meetingTimestamp()}` };
      const res = await processAudio(uri, meta);
      // A failed local save shouldn't lose the result the user just waited for —
      // show it anyway; it just won't appear in history.
      try {
        await saveMeeting(res);
      } catch (saveErr) {
        console.warn("Couldn't save meeting to history:", saveErr);
      }
      setResult(res);
      setTab("polished");
      setPhase("result");
    } catch (err) {
      setErrorMsg(toMessage(err, "Processing failed. Please try again."));
      setPhase("error");
    }
  }

  function reset() {
    setResult(null);
    setElapsed(0);
    setPhase("idle");
  }

  if (showHistory) {
    return (
      <HistoryScreen
        onClose={() => setShowHistory(false)}
        onOpen={(r) => {
          setResult(r);
          setTab("polished");
          setPhase("result");
          setShowHistory(false);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Pressable onPress={() => setShowHistory(true)} hitSlop={12}>
          <Text style={styles.headerIcon}>☰</Text>
        </Pressable>
        <View style={styles.brand}>
          <Mark size={18} />
          <Text style={styles.brandText}>ThinkMate</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {phase === "result" && result ? (
        <ResultScreen result={result} tab={tab} setTab={setTab} onNew={reset} />
      ) : (
        <CaptureScreen
          phase={phase}
          elapsed={elapsed}
          errorMsg={errorMsg}
          onStart={start}
          onPause={pause}
          onResume={resume}
          onStop={stopAndProcess}
          onRetry={reset}
        />
      )}
    </SafeAreaView>
  );
}

function CaptureScreen({
  phase,
  elapsed,
  errorMsg,
  onStart,
  onPause,
  onResume,
  onStop,
  onRetry,
}: {
  phase: Phase;
  elapsed: number;
  errorMsg: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetry: () => void;
}) {
  const active = phase === "recording";
  const statusText =
    phase === "recording" ? "Listening" :
    phase === "paused" ? "Paused" :
    phase === "processing" ? "Thinking…" :
    phase === "error" ? "Something went wrong" :
    "Ready";
  const subText =
    phase === "recording" || phase === "paused" ? "Recording meeting" :
    phase === "processing" ? "Transcribing and understanding" :
    phase === "error" ? errorMsg :
    "Tap start to capture a meeting";

  return (
    <View style={styles.captureBody}>
      <View style={styles.statusBlock}>
        <Text style={[styles.status, active && { color: colors.accent }]}>{statusText}</Text>
        <Text style={styles.statusSub}>{subText}</Text>
      </View>

      <View style={styles.discArea}>
        {phase === "processing" ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : (
          <ListeningDisc active={active} />
        )}
      </View>

      {(phase === "recording" || phase === "paused") && (
        <Text style={styles.timer}>{mmss(elapsed)}</Text>
      )}

      <View style={styles.controls}>
        {phase === "idle" && <Button label="Start meeting" onPress={onStart} />}
        {phase === "recording" && (
          <View style={styles.row}>
            <Button label="Pause" variant="ghost" onPress={onPause} />
            <Button label="Stop" variant="danger" onPress={onStop} />
          </View>
        )}
        {phase === "paused" && (
          <View style={styles.row}>
            <Button label="Resume" onPress={onResume} />
            <Button label="Stop" variant="danger" onPress={onStop} />
          </View>
        )}
        {phase === "error" && <Button label="Try again" onPress={onRetry} />}
      </View>

      {phase === "idle" && <CaptureFooter />}
    </View>
  );
}

function openLink(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert("Couldn't open link", "Please try again later.");
  });
}

/** Developer credit + privacy link, shown on the idle home screen. */
function CaptureFooter() {
  return (
    <View style={styles.captureFooter}>
      <View style={styles.footerLinks}>
        <Pressable onPress={() => openLink("https://lumalien.com")} hitSlop={8}>
          <Text style={styles.footerLink}>Lumalien</Text>
        </Pressable>
        <Text style={styles.footerDot}>·</Text>
        <Pressable onPress={() => openLink(PRIVACY_POLICY_URL)} hitSlop={8}>
          <Text style={styles.footerLink}>Privacy Policy</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ResultScreen({
  result,
  tab,
  setTab,
  onNew,
}: {
  result: MeetingResult;
  tab: "raw" | "polished";
  setTab: (t: "raw" | "polished") => void;
  onNew: () => void;
}) {
  const [sharing, setSharing] = useState(false);

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    const res = await shareMeeting(result, tab);
    setSharing(false);
    if (res.error) Alert.alert("Couldn't share", res.error);
  }

  return (
    <View style={styles.resultBody}>
      <Text style={styles.resultTitle} numberOfLines={1}>
        {result.meta?.title ?? "Meeting"}
      </Text>
      <View style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { key: "raw", label: "Raw" },
            { key: "polished", label: "Polished" },
          ]}
        />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "raw" ? <RawView result={result} /> : <PolishedView result={result} />}
        <Text style={styles.aiNote}>
          AI can make mistakes — please double-check anything important.
        </Text>
      </ScrollView>
      <View style={styles.resultFooter}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button
              label={sharing ? "Sharing…" : tab === "raw" ? "Save transcript" : "Save summary"}
              variant="ghost"
              onPress={onShare}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="New meeting" onPress={onNew} />
          </View>
        </View>
      </View>
    </View>
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
  headerIcon: { color: colors.text, fontSize: 22 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { color: colors.text, fontSize: 18, fontWeight: "700" },

  captureBody: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingVertical: space.xl },
  statusBlock: { alignItems: "center", gap: 4 },
  status: { color: colors.text, fontSize: 20, fontWeight: "700" },
  statusSub: { color: colors.textMuted, fontSize: 14 },
  discArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  timer: { color: colors.text, fontSize: 40, fontWeight: "300", fontVariant: ["tabular-nums"], marginBottom: space.lg },
  controls: { width: "100%", paddingHorizontal: space.lg },
  row: { flexDirection: "row", gap: space.md, justifyContent: "center" },
  captureFooter: { alignItems: "center", paddingTop: space.lg },
  footerLinks: { flexDirection: "row", alignItems: "center", gap: space.sm },
  footerLink: { color: colors.textFaint, fontSize: 13, fontWeight: "600" },
  footerDot: { color: colors.textFaint, fontSize: 13 },

  resultBody: { flex: 1 },
  resultTitle: { color: colors.text, fontSize: 16, fontWeight: "700", paddingHorizontal: space.lg, marginBottom: space.md },
  aiNote: { color: colors.textFaint, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: space.xl },
  resultFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
