// Ported concept from openchamber/openchamber (MIT): packages/ui/src/components/sections/skills/catalog/SkillsCatalogPage.tsx
// Installs skills (SKILL.md directories) from a GitHub repo into the OMP/pi user skills dir, and
// lists what's installed. Data via the daemon skills RPC.
import { useCallback, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useSkills,
  type InstalledSkill,
  type ScannedSkill,
  type SkillsCatalogError,
} from "@/hooks/use-skills";
import { SettingsSection } from "@/screens/settings/settings-section";
import { settingsStyles } from "@/styles/settings";
import { useI18n } from "@/lib/i18n";

const ThemedTextInput = withUnistyles(TextInput, (theme) => ({
  placeholderTextColor: theme.colors.foregroundMuted,
}));

interface SkillsSectionProps {
  serverId: string;
}

function describeError(error: SkillsCatalogError): string {
  if (error.kind === "conflicts" && error.conflicts && error.conflicts.length > 0) {
    return `Already installed: ${error.conflicts.join(", ")}. Use Overwrite to replace.`;
  }
  if (error.kind === "authRequired") {
    return "Authentication required for this repository (private repos need SSH).";
  }
  if (error.kind === "gitUnavailable") {
    return "git is not available on this host.";
  }
  return error.message;
}

function ScannedSkillRow({
  skill,
  selected,
  onToggle,
}: {
  skill: ScannedSkill;
  selected: boolean;
  onToggle: (skillDir: string, next: boolean) => void;
}) {
  const handleChange = useCallback(
    (next: boolean) => onToggle(skill.skillDir, next),
    [onToggle, skill.skillDir],
  );
  return (
    <View style={styles.scanRow}>
      <View style={styles.scanRowText}>
        <Text style={styles.skillName}>{skill.name}</Text>
        {skill.description ? (
          <Text style={styles.skillDescription} numberOfLines={2}>
            {skill.description}
          </Text>
        ) : null}
      </View>
      <Switch value={selected} onValueChange={handleChange} />
    </View>
  );
}

function InstalledSkillsList({
  installed,
  isLoading,
}: {
  installed: InstalledSkill[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <View style={settingsStyles.card}>
        <Text style={styles.emptyHint}>Loading skills…</Text>
      </View>
    );
  }
  if (installed.length === 0) {
    return (
      <View style={settingsStyles.card}>
        <Text style={styles.emptyHint}>No skills installed.</Text>
      </View>
    );
  }
  return (
    <View style={settingsStyles.card}>
      {installed.map((skill) => (
        <View key={skill.path} style={styles.installedRow}>
          <Text style={styles.skillName}>{skill.name}</Text>
          {skill.description ? (
            <Text style={styles.skillDescription} numberOfLines={2}>
              {skill.description}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function SkillsSection({ serverId }: SkillsSectionProps) {
  const { t } = useI18n();
  const { installed, isLoading, scan, install } = useSkills(serverId);
  const [source, setSource] = useState("");
  const [scanned, setScanned] = useState<ScannedSkill[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [hadConflict, setHadConflict] = useState(false);

  const handleToggle = useCallback((skillDir: string, next: boolean) => {
    setSelected((prev) => {
      const updated = new Set(prev);
      if (next) {
        updated.add(skillDir);
      } else {
        updated.delete(skillDir);
      }
      return updated;
    });
  }, []);

  const handleScan = useCallback(async () => {
    const trimmed = source.trim();
    if (!trimmed) {
      return;
    }
    setBusy(true);
    setStatus(null);
    setHadConflict(false);
    setScanned([]);
    setSelected(new Set());
    try {
      const outcome = await scan(trimmed);
      if (outcome.error) {
        setStatus(describeError(outcome.error));
        return;
      }
      if (outcome.skills.length === 0) {
        setStatus("No SKILL.md directories found in that repository.");
        return;
      }
      setScanned(outcome.skills);
      setSelected(new Set(outcome.skills.map((skill) => skill.skillDir)));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }, [scan, source]);

  const runInstall = useCallback(
    async (overwrite: boolean) => {
      const skillDirs = scanned
        .filter((skill) => selected.has(skill.skillDir))
        .map((skill) => skill.skillDir);
      if (skillDirs.length === 0) {
        return;
      }
      setBusy(true);
      setStatus(null);
      try {
        const outcome = await install({ source: source.trim(), skillDirs, overwrite });
        if (outcome.error) {
          setHadConflict(outcome.error.kind === "conflicts");
          setStatus(describeError(outcome.error));
          return;
        }
        setHadConflict(false);
        const installedCount = outcome.installed.length;
        const skippedCount = outcome.skipped.length;
        setStatus(
          `Installed ${installedCount} skill${installedCount === 1 ? "" : "s"}` +
            (skippedCount > 0 ? `, skipped ${skippedCount}.` : "."),
        );
        setScanned([]);
        setSelected(new Set());
        setSource("");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Install failed");
      } finally {
        setBusy(false);
      }
    },
    [install, scanned, selected, source],
  );

  const handleInstall = useCallback(() => {
    void runInstall(false);
  }, [runInstall]);

  const handleOverwrite = useCallback(() => {
    void runInstall(true);
  }, [runInstall]);

  const selectedCount = useMemo(
    () => scanned.filter((skill) => selected.has(skill.skillDir)).length,
    [scanned, selected],
  );

  return (
    <SettingsSection title={t("skills.title")} testID="host-page-skills">
      <InstalledSkillsList installed={installed} isLoading={isLoading} />

      <View style={styles.installCard}>
        <Text style={styles.installLabel}>Install from GitHub</Text>
        <View style={styles.inputRow}>
          <ThemedTextInput
            style={styles.input}
            value={source}
            onChangeText={setSource}
            placeholder="owner/repo or owner/repo/subpath"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          <Button
            variant="secondary"
            onPress={handleScan}
            loading={busy && scanned.length === 0}
            disabled={busy}
          >
            Scan
          </Button>
        </View>

        {scanned.length > 0 ? (
          <View style={styles.scanList}>
            {scanned.map((skill) => (
              <ScannedSkillRow
                key={skill.skillDir}
                skill={skill}
                selected={selected.has(skill.skillDir)}
                onToggle={handleToggle}
              />
            ))}
            <View style={styles.installActions}>
              <Button
                variant="default"
                onPress={handleInstall}
                disabled={busy || selectedCount === 0}
              >
                {`Install ${selectedCount}`}
              </Button>
              {hadConflict ? (
                <Button variant="outline" onPress={handleOverwrite} disabled={busy}>
                  Overwrite
                </Button>
              ) : null}
            </View>
          </View>
        ) : null}

        {status ? <Text style={styles.statusText}>{status}</Text> : null}
      </View>
    </SettingsSection>
  );
}

const styles = StyleSheet.create((theme) => ({
  emptyHint: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
  },
  installedRow: {
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing[1],
  },
  skillName: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
  },
  skillDescription: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  installCard: {
    marginTop: theme.spacing[3],
    gap: theme.spacing[3],
  },
  installLabel: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    marginLeft: theme.spacing[1],
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface1,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
  scanList: {
    backgroundColor: theme.colors.surface1,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    gap: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  scanRowText: {
    flex: 1,
    gap: theme.spacing[1],
  },
  installActions: {
    flexDirection: "row",
    gap: theme.spacing[2],
    padding: theme.spacing[3],
  },
  statusText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    marginLeft: theme.spacing[1],
  },
}));
