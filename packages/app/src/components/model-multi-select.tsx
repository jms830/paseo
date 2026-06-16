// Ported concept from openchamber/openchamber (MIT): ModelMultiSelect.
// Presentational toggle-chip picker over available (provider, model) pairs for multi-run.
import { useCallback, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export interface ModelOption {
  provider: string;
  model: string;
  label: string;
}

export function modelOptionKey(provider: string, model: string): string {
  return `${provider}::${model}`;
}

interface ModelMultiSelectProps {
  options: ModelOption[];
  selectedKeys: Set<string>;
  onToggle: (option: ModelOption) => void;
}

function ModelChip({
  option,
  selected,
  onToggle,
}: {
  option: ModelOption;
  selected: boolean;
  onToggle: (option: ModelOption) => void;
}) {
  const handlePress = useCallback(() => onToggle(option), [onToggle, option]);
  const a11yState = useMemo(() => ({ selected }), [selected]);
  return (
    <Pressable
      onPress={handlePress}
      style={selected ? selectedChipStyle : chipStyle}
      accessibilityRole="button"
      accessibilityState={a11yState}
      testID={`multi-run-model-${option.provider}-${option.model}`}
    >
      <Text style={selected ? styles.chipTextSelected : styles.chipText} numberOfLines={1}>
        {option.label}
      </Text>
    </Pressable>
  );
}

export function ModelMultiSelect({ options, selectedKeys, onToggle }: ModelMultiSelectProps) {
  if (options.length === 0) {
    return <Text style={styles.empty}>No models available for this host.</Text>;
  }
  return (
    <View style={styles.container}>
      {options.map((option) => (
        <ModelChip
          key={modelOptionKey(option.provider, option.model)}
          option={option}
          selected={selectedKeys.has(modelOptionKey(option.provider, option.model))}
          onToggle={onToggle}
        />
      ))}
    </View>
  );
}

function chipStyle({ hovered = false }: { hovered?: boolean }) {
  return [styles.chip, hovered && styles.chipHovered];
}

function selectedChipStyle({ hovered = false }: { hovered?: boolean }) {
  return [styles.chip, styles.chipSelected, hovered && styles.chipSelectedHovered];
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
  },
  empty: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  chip: {
    paddingVertical: theme.spacing[1],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface1,
  },
  chipHovered: {
    backgroundColor: theme.colors.surface2,
  },
  chipSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  chipSelectedHovered: {
    opacity: 0.9,
  },
  chipText: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
  chipTextSelected: {
    color: theme.colors.accentForeground,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
}));
