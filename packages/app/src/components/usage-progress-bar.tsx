// Ported concept from openchamber/openchamber (MIT): packages/ui/src/components/sections/usage/UsageProgressBar.tsx
import { useMemo } from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import type { Theme } from "@/styles/theme";

interface UsageProgressBarProps {
  /** 0-100, or null when the provider exposes only a value label. */
  percent: number | null;
}

function resolveToneColor(percent: number, theme: Theme): string {
  if (percent >= 80) {
    return theme.colors.destructive;
  }
  if (percent >= 50) {
    return theme.colors.palette.amber[500];
  }
  return theme.colors.palette.green[500];
}

export function UsageProgressBar({ percent }: UsageProgressBarProps) {
  const { theme } = useUnistyles();

  const fillStyle = useMemo(() => {
    if (percent === null || !Number.isFinite(percent)) {
      return null;
    }
    const clamped = Math.max(0, Math.min(100, percent));
    return [
      styles.fill,
      { width: `${clamped}%` as const, backgroundColor: resolveToneColor(clamped, theme) },
    ];
  }, [percent, theme]);

  return <View style={styles.track}>{fillStyle ? <View style={fillStyle} /> : null}</View>;
}

const styles = StyleSheet.create((theme) => ({
  track: {
    height: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: theme.borderRadius.full,
  },
}));
