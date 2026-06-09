import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
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
