// Ported concept from openchamber/openchamber (MIT): MultiRunLauncher.
// Launches one prompt across multiple selected models in parallel (one agent per model).
import { useCallback, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { AdaptiveModalSheet } from "@/components/adaptive-modal-sheet";
import { Button } from "@/components/ui/button";
import {
  ModelMultiSelect,
  modelOptionKey,
  type ModelOption,
} from "@/components/model-multi-select";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import { useMultiRunStore, type MultiRunModelSelection } from "@/stores/multi-run-store";
import { useI18n } from "@/lib/i18n";

const ThemedTextInput = withUnistyles(TextInput, (theme) => ({
  placeholderTextColor: theme.colors.foregroundMuted,
}));

interface MultiRunLauncherProps {
  serverId: string;
  cwd: string;
  workspaceId: string;
  visible: boolean;
  onClose: () => void;
}

export function MultiRunLauncher({
  serverId,
  cwd,
  workspaceId,
  visible,
  onClose,
}: MultiRunLauncherProps) {
  const { entries } = useProvidersSnapshot(serverId, { cwd, enabled: visible });
  const { t } = useI18n();
  const header = useMemo(() => ({ title: t("multiRun.title") }), [t]);
  const launch = useMultiRunStore((state) => state.launch);
  const [prompt, setPrompt] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo<ModelOption[]>(() => {
    const result: ModelOption[] = [];
    for (const entry of entries ?? []) {
      if (!entry.enabled || !entry.models) {
        continue;
      }
      for (const model of entry.models) {
        result.push({ provider: entry.provider, model: model.id, label: model.label });
      }
    }
    return result;
  }, [entries]);

  const handleToggle = useCallback((option: ModelOption) => {
    const key = modelOptionKey(option.provider, option.model);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectedModels = useMemo<MultiRunModelSelection[]>(
    () =>
      options
        .filter((option) => selectedKeys.has(modelOptionKey(option.provider, option.model)))
        .map((option) => ({ provider: option.provider, model: option.model })),
    [options, selectedKeys],
  );

  const handleLaunch = useCallback(() => {
    void (async () => {
      setLaunching(true);
      setError(null);
      try {
        await launch({ serverId, cwd, workspaceId, prompt, models: selectedModels });
        setPrompt("");
        setSelectedKeys(new Set());
        onClose();
      } catch (launchError) {
        setError(launchError instanceof Error ? launchError.message : "Failed to launch");
      } finally {
        setLaunching(false);
      }
    })();
  }, [launch, serverId, cwd, workspaceId, prompt, selectedModels, onClose]);

  const canLaunch = prompt.trim().length > 0 && selectedModels.length > 0 && !launching;

  return (
    <AdaptiveModalSheet
      header={header}
      visible={visible}
      onClose={onClose}
      testID="multi-run-launcher"
    >
      <View style={styles.body}>
        <Text style={styles.label}>Prompt</Text>
        <ThemedTextInput
          style={styles.promptInput}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="What should every model do?"
          multiline
          editable={!launching}
        />
        <Text style={styles.label}>{`Models (${selectedModels.length} selected)`}</Text>
        <ModelMultiSelect options={options} selectedKeys={selectedKeys} onToggle={handleToggle} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.actions}>
          <Button
            variant="default"
            onPress={handleLaunch}
            loading={launching}
            disabled={!canLaunch}
          >
            {`Launch ${selectedModels.length || ""}`.trim()}
          </Button>
          <Button variant="ghost" onPress={onClose} disabled={launching}>
            Cancel
          </Button>
        </View>
      </View>
    </AdaptiveModalSheet>
  );
}

/**
 * Self-contained multi-run entry point for the workspace draft tab: a trigger button plus the
 * launcher modal. Renders nothing until a workspace directory and id are available.
 */
export function WorkspaceDraftMultiRun({
  serverId,
  cwd,
  authority,
}: {
  serverId: string;
  cwd: string | null;
  authority: { workspaceId: string } | null;
}) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const workspaceId = authority?.workspaceId ?? null;
  if (!cwd || !workspaceId) {
    return null;
  }
  return (
    <View style={styles.draftEntryRow}>
      <Button variant="outline" size="sm" onPress={open}>
        Run across multiple models…
      </Button>
      <MultiRunLauncher
        serverId={serverId}
        cwd={cwd}
        workspaceId={workspaceId}
        visible={visible}
        onClose={close}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing[3],
    padding: theme.spacing[2],
  },
  draftEntryRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing[3],
  },
  label: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
  },
  promptInput: {
    minHeight: 72,
    backgroundColor: theme.colors.surface1,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    textAlignVertical: "top",
  },
  errorText: {
    color: theme.colors.destructive,
    fontSize: theme.fontSize.xs,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
  },
}));
