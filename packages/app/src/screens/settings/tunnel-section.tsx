// Ported concept from openchamber/openchamber (MIT): TunnelSettings.
// Starts/stops a Cloudflare quick tunnel exposing this host's local daemon port, surfacing the
// public URL. An optional alternative to Paseo's native relay + device pairing.
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { TunnelStatus } from "@getpaseo/protocol/tunnel/types";
import { Button } from "@/components/ui/button";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";
import { SettingsSection } from "@/screens/settings/settings-section";
import { settingsStyles } from "@/styles/settings";

interface TunnelSectionProps {
  serverId: string;
}

function describeState(status: TunnelStatus | null): string {
  if (!status) {
    return "…";
  }
  switch (status.state) {
    case "running":
      return status.url ?? "Running";
    case "starting":
      return "Starting…";
    case "error":
      return status.error ?? "Error";
    default:
      return "Not running";
  }
}

export function TunnelSection({ serverId }: TunnelSectionProps) {
  const client = useHostRuntimeClient(serverId);
  const isConnected = useHostRuntimeIsConnected(serverId);
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!client) {
      return;
    }
    try {
      const payload = await client.tunnelStatus();
      setStatus(payload.status);
    } catch {
      setStatus(null);
    }
  }, [client]);

  useEffect(() => {
    if (isConnected) {
      void refresh();
    }
  }, [isConnected, refresh]);

  const handleStart = useCallback(() => {
    void (async () => {
      if (!client) {
        return;
      }
      setBusy(true);
      try {
        const payload = await client.tunnelStart();
        setStatus(payload.status);
      } finally {
        setBusy(false);
      }
    })();
  }, [client]);

  const handleStop = useCallback(() => {
    void (async () => {
      if (!client) {
        return;
      }
      setBusy(true);
      try {
        const payload = await client.tunnelStop();
        setStatus(payload.status);
      } finally {
        setBusy(false);
      }
    })();
  }, [client]);

  const running = status?.state === "running" || status?.state === "starting";

  return (
    <SettingsSection title="Remote tunnel" testID="host-page-tunnel">
      <View style={settingsStyles.card}>
        <View style={settingsStyles.row}>
          <View style={settingsStyles.rowContent}>
            <Text style={settingsStyles.rowTitle}>Cloudflare quick tunnel</Text>
            <Text style={settingsStyles.rowHint} numberOfLines={2}>
              {describeState(status)}
            </Text>
          </View>
          {running ? (
            <Button
              variant="secondary"
              size="sm"
              onPress={handleStop}
              loading={busy}
              disabled={busy}
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onPress={handleStart}
              loading={busy}
              disabled={busy}
            >
              Start
            </Button>
          )}
        </View>
      </View>
      <Text style={styles.note}>
        Exposes this host&apos;s local port publicly via cloudflared. Paseo&apos;s relay + device
        pairing remains the recommended remote-access path.
      </Text>
    </SettingsSection>
  );
}

const styles = StyleSheet.create((theme) => ({
  note: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing[2],
    marginLeft: theme.spacing[1],
  },
}));
