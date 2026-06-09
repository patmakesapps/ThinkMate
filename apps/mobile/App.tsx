import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { saveMeeting } from "./src/db";
import type { MeetingResult } from "./src/types";
import { HistoryScreen } from "./src/HistoryScreen";

type Phase = "idle" | "recording" | "paused" | "processing" | "result" | "error";

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

  async function start() {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Microphone needed", "ThinkMate needs the microphone to record the meeting.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setElapsed(0);
    setPhase("recording");
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
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setErrorMsg("No recording was captured.");
      setPhase("error");
      return;
    }
    setPhase("processing");
    try {
      const meta = { title: `Meeting · ${new Date().toLocaleString()}` };
      const res = await processAudio(uri, meta);
      await saveMeeting(res);
      setResult(res);
      setTab("polished");
      setPhase("result");
    } catch (err) {
      setErrorMsg((err as Error).message ?? "Processing failed.");
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
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "raw" ? <RawView result={result} /> : <PolishedView result={result} />}
      </ScrollView>
      <View style={styles.resultFooter}>
        <Button label="New meeting" onPress={onNew} />
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

  resultBody: { flex: 1 },
  resultTitle: { color: colors.text, fontSize: 16, fontWeight: "700", paddingHorizontal: space.lg, marginBottom: space.md },
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
