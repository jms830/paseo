// Ported concept from openchamber/openchamber (MIT): packages/ui/src/components/sections/usage/UsagePage.tsx
// Renders configured-provider quota windows for a host. Data via the daemon quota RPC.
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { RotateCw } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import type { ProviderResult, UsageWindow } from "@getpaseo/protocol/quota/types";
import { useQuota } from "@/hooks/use-quota";
import { UsageProgressBar } from "@/components/usage-progress-bar";
import { SettingsSection } from "@/screens/settings/settings-section";
import { settingsStyles } from "@/styles/settings";
import { useI18n } from "@/lib/i18n";

interface UsageSectionProps {
  serverId: string;
}

function formatWindowValue(window: UsageWindow): string | null {
  if (window.valueLabel) {
    return window.valueLabel;
  }
  if (typeof window.usedPercent === "number" && Number.isFinite(window.usedPercent)) {
    return `${Math.round(window.usedPercent)}% used`;
  }
  return null;
}

function WindowRow({ label, window }: { label: string; window: UsageWindow }) {
  const value = formatWindowValue(window);
  return (
    <View style={styles.windowRow}>
      <View style={styles.windowHeader}>
        <Text style={styles.windowLabel}>{label}</Text>
        {value ? <Text style={styles.windowValue}>{value}</Text> : null}
      </View>
      <UsageProgressBar percent={window.usedPercent} />
      {window.resetAtFormatted ? (
        <Text style={styles.windowReset}>Resets {window.resetAtFormatted}</Text>
      ) : null}
    </View>
  );
}

function ProviderCard({ result }: { result: ProviderResult }) {
  const windows = result.usage?.windows ?? {};
  const windowEntries = Object.entries(windows);
  return (
    <View style={styles.providerCard}>
      <Text style={styles.providerName}>{result.providerName}</Text>
      {result.ok && windowEntries.length > 0 ? (
        windowEntries.map(([key, window]) => <WindowRow key={key} label={key} window={window} />)
      ) : (
        <Text style={styles.providerHint}>{result.error ?? "No usage data"}</Text>
      )}
    </View>
  );
}

export function UsageSection({ serverId }: UsageSectionProps) {
  const { theme } = useUnistyles();
  const { t } = useI18n();
  const { results, isLoading, isFetching, error, refetch } = useQuota(serverId);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const configured = results.filter((result) => result.configured);

  const refreshButton = (
    <Pressable
      onPress={handleRefresh}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Refresh usage"
      testID={`usage-refresh-${serverId}`}
    >
      <RotateCw size={theme.iconSize.sm} color={theme.colors.foregroundMuted} />
    </Pressable>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = <Text style={settingsStyles.rowHint}>Loading usage…</Text>;
  } else if (error) {
    body = <Text style={styles.errorText}>{error}</Text>;
  } else if (configured.length === 0) {
    body = (
      <Text style={settingsStyles.rowHint}>
        No quota-reporting providers are configured for this host.
      </Text>
    );
  } else {
    body = (
      <View style={settingsStyles.card}>
        {configured.map((result) => (
          <ProviderCard key={result.providerId} result={result} />
        ))}
      </View>
    );
  }

  return (
    <SettingsSection
      title={t("usage.title")}
      trailing={isFetching ? null : refreshButton}
      testID="host-page-usage"
    >
      {body}
    </SettingsSection>
  );
}

const styles = StyleSheet.create((theme) => ({
  providerCard: {
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing[3],
  },
  providerName: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
  providerHint: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  windowRow: {
    gap: theme.spacing[1],
  },
  windowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  windowLabel: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  windowValue: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.xs,
  },
  windowReset: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  errorText: {
    color: theme.colors.destructive,
    fontSize: theme.fontSize.xs,
  },
}));
