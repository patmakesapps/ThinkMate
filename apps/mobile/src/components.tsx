import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "./theme";

/** Three-bar ThinkMate mark used in the disc center and header. */
export function Mark({ size = 28, color = colors.text }: { size?: number; color?: string }) {
  const bar = (h: number) => (
    <View
      style={{
        width: size * 0.12,
        height: h,
        borderRadius: 999,
        backgroundColor: color,
        marginHorizontal: size * 0.05,
      }}
    />
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", height: size }}>
      {bar(size * 0.55)}
      {bar(size)}
      {bar(size * 0.7)}
    </View>
  );
}

/**
 * The metallic listening disc. Pulses and emits expanding rings while active.
 */
export function ListeningDisc({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      ring.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const r = Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    p.start();
    r.start();
    return () => {
      p.stop();
      r.stop();
    };
  }, [active]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={discStyles.wrap}>
      {active && (
        <Animated.View
          style={[discStyles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
        />
      )}
      <Animated.View style={[discStyles.glow, active && { opacity: 0.9 }]} />
      <Animated.View style={[discStyles.disc, { transform: [{ scale }] }]}>
        <View style={discStyles.discInner}>
          <Mark size={42} color={colors.metalLight} />
        </View>
      </Animated.View>
    </View>
  );
}

const DISC = 220;
const discStyles = StyleSheet.create({
  wrap: { width: DISC * 1.7, height: DISC * 1.7, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  glow: {
    position: "absolute",
    width: DISC + 40,
    height: DISC + 40,
    borderRadius: (DISC + 40) / 2,
    backgroundColor: colors.accentGlow,
    opacity: 0.35,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: colors.metalMid,
    borderWidth: 6,
    borderColor: colors.metalDark,
    alignItems: "center",
    justifyContent: "center",
  },
  discInner: {
    width: DISC - 44,
    height: DISC - 44,
    borderRadius: (DISC - 44) / 2,
    backgroundColor: "#9A9FAB",
    borderWidth: 2,
    borderColor: colors.metalLight,
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * Processing feedback for the "Thinking…" step. The backend doesn't report real
 * progress, so this shows an indeterminate moving bar plus messages that walk
 * through the stages, so the user always sees that something is happening (and
 * that a cold start can take a moment).
 */
const PROCESSING_STAGES = [
  "Uploading your recording…",
  "Transcribing the conversation…",
  "Finding decisions and action items…",
  "Polishing the summary…",
  "Almost there…",
];

export function ProcessingIndicator() {
  const slide = useRef(new Animated.Value(0)).current;
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    anim.start();

    // Advance through the stage messages, then hold on the last one.
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, PROCESSING_STAGES.length - 1));
    }, 4000);

    return () => {
      anim.stop();
      clearInterval(id);
    };
  }, []);

  const TRACK = 240;
  const CHUNK = 88;
  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-CHUNK, TRACK],
  });

  return (
    <View style={progress.wrap}>
      <View style={[progress.track, { width: TRACK }]}>
        <Animated.View style={[progress.chunk, { width: CHUNK, transform: [{ translateX }] }]} />
      </View>
      <Text style={progress.stage}>{PROCESSING_STAGES[stage]}</Text>
      <Text style={progress.hint}>This can take up to a minute — please keep the app open.</Text>
    </View>
  );
}

const progress = StyleSheet.create({
  wrap: { alignItems: "center", gap: space.md, paddingHorizontal: space.lg },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
    overflow: "hidden",
  },
  chunk: { height: 6, borderRadius: 999, backgroundColor: colors.accent },
  stage: { color: colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" },
  hint: { color: colors.textFaint, fontSize: 12, textAlign: "center", lineHeight: 17 },
});

/** Raw | Polished pill toggle. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={tabStyles.wrap}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[tabStyles.tab, active && tabStyles.tabActive]}
          >
            <Text style={[tabStyles.label, active && tabStyles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: space.sm, alignItems: "center", borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.surfaceRaised },
  label: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  labelActive: { color: colors.text },
});

/** Pill button used for primary/secondary actions. */
export function Button({
  label,
  onPress,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        btn.base,
        variant === "primary" && btn.primary,
        variant === "ghost" && btn.ghost,
        variant === "danger" && btn.danger,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text
        style={[
          btn.label,
          variant === "ghost" && { color: colors.text },
          variant === "danger" && { color: colors.danger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const btn = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: radius.pill, alignItems: "center" },
  primary: { backgroundColor: colors.accent },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger },
  label: { color: "#06121F", fontSize: 16, fontWeight: "700" },
});

/**
 * Small themed confirmation dialog. Used for every destructive action so a
 * delete always asks first, with an on-brand look instead of the OS alert.
 * Render it once and toggle `visible`; `onCancel`/`onConfirm` close it.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={confirm.backdrop} onPress={onCancel}>
        {/* Stop taps inside the card from dismissing. */}
        <Pressable style={confirm.card} onPress={() => {}}>
          <Text style={confirm.title}>{title}</Text>
          {message ? <Text style={confirm.message}>{message}</Text> : null}
          <View style={confirm.row}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [confirm.action, confirm.cancel, pressed && { opacity: 0.8 }]}
            >
              <Text style={confirm.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                confirm.action,
                destructive ? confirm.confirmDanger : confirm.confirmPrimary,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[confirm.confirmText, destructive && { color: "#FFFFFF" }]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const confirm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: space.xs },
  message: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: space.lg },
  row: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  action: { flex: 1, paddingVertical: 12, borderRadius: radius.pill, alignItems: "center" },
  cancel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  confirmPrimary: { backgroundColor: colors.accent },
  confirmDanger: { backgroundColor: colors.danger },
  confirmText: { color: "#06121F", fontSize: 15, fontWeight: "700" },
});
