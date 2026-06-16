// Ported concept from openchamber/openchamber (MIT): GitPage + GitIdentityEditorDialog.
// Lists named git identity profiles and applies one to a repository (writes repo-local
// user.name/user.email via the daemon git-identity RPC).
import { useCallback, useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { RepoGitIdentity } from "@getpaseo/protocol/git-identity/types";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/screens/settings/settings-section";
import { settingsStyles } from "@/styles/settings";
import { useI18n } from "@/lib/i18n";
import { useGitIdentitiesStore, type GitIdentityProfile } from "@/stores/git-identities-store";

const ThemedTextInput = withUnistyles(TextInput, (theme) => ({
  placeholderTextColor: theme.colors.foregroundMuted,
}));

interface GitIdentitySectionProps {
  client: DaemonClient;
  cwd: string;
}

function formatCurrentIdentity(current: RepoGitIdentity | null): string {
  if (!current) {
    return "…";
  }
  if (!current.name && !current.email) {
    return "Not configured";
  }
  const name = current.name ?? "(no name)";
  const email = current.email ?? "(no email)";
  const suffix = current.local ? "" : " (inherited)";
  return `${name} <${email}>${suffix}`;
}

function ProfileRow({
  profile,
  applying,
  onApply,
  onRemove,
}: {
  profile: GitIdentityProfile;
  applying: boolean;
  onApply: (profile: GitIdentityProfile) => void;
  onRemove: (id: string) => void;
}) {
  const handleApply = useCallback(() => onApply(profile), [onApply, profile]);
  const handleRemove = useCallback(() => onRemove(profile.id), [onRemove, profile.id]);
  return (
    <View style={styles.profileRow}>
      <View style={styles.profileText}>
        <Text style={styles.profileLabel}>{profile.label}</Text>
        <Text style={styles.profileMeta} numberOfLines={1}>
          {profile.name} {"<"}
          {profile.email}
          {">"}
        </Text>
      </View>
      <View style={styles.profileActions}>
        <Button
          variant="secondary"
          size="sm"
          onPress={handleApply}
          loading={applying}
          disabled={applying}
        >
          Apply
        </Button>
        <Button variant="ghost" size="sm" onPress={handleRemove} disabled={applying}>
          Remove
        </Button>
      </View>
    </View>
  );
}

export function GitIdentitySection({ client, cwd }: GitIdentitySectionProps) {
  const { t } = useI18n();
  const profiles = useGitIdentitiesStore((state) => state.profiles);
  const addProfile = useGitIdentitiesStore((state) => state.addProfile);
  const removeProfile = useGitIdentitiesStore((state) => state.removeProfile);

  const [current, setCurrent] = useState<RepoGitIdentity | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const refresh = useCallback(async () => {
    try {
      const payload = await client.gitIdentityGet(cwd);
      setCurrent(payload.identity);
    } catch {
      setCurrent(null);
    }
  }, [client, cwd]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleApply = useCallback(
    (profile: GitIdentityProfile) => {
      void (async () => {
        setApplyingId(profile.id);
        setStatus(null);
        try {
          const payload = await client.gitIdentitySet({
            cwd,
            name: profile.name,
            email: profile.email,
          });
          if (payload.error) {
            setStatus(payload.error);
          } else {
            setCurrent(payload.identity);
            setStatus(`Applied "${profile.label}" to this repository.`);
          }
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "Failed to apply identity");
        } finally {
          setApplyingId(null);
        }
      })();
    },
    [client, cwd],
  );

  const handleStartAdd = useCallback(() => setAdding(true), []);
  const handleCancelAdd = useCallback(() => {
    setAdding(false);
    setLabel("");
    setName("");
    setEmail("");
  }, []);

  const handleSaveAdd = useCallback(() => {
    if (!name.trim() || !email.trim()) {
      setStatus("Name and email are required");
      return;
    }
    addProfile({ label, name, email });
    handleCancelAdd();
  }, [addProfile, label, name, email, handleCancelAdd]);

  const currentLabel = formatCurrentIdentity(current);

  return (
    <SettingsSection title={t("gitIdentity.title")} testID="project-git-identity">
      <View style={settingsStyles.card}>
        <View style={settingsStyles.row}>
          <View style={settingsStyles.rowContent}>
            <Text style={settingsStyles.rowTitle}>Current</Text>
            <Text style={settingsStyles.rowHint}>{currentLabel}</Text>
          </View>
        </View>
        {profiles.map((profile) => (
          <View key={profile.id} style={styles.borderedRow}>
            <ProfileRow
              profile={profile}
              applying={applyingId === profile.id}
              onApply={handleApply}
              onRemove={removeProfile}
            />
          </View>
        ))}
      </View>

      {adding ? (
        <View style={styles.addCard}>
          <ThemedTextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="Label (e.g. Work)"
            autoCapitalize="none"
          />
          <ThemedTextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Name (user.name)"
            autoCapitalize="none"
          />
          <ThemedTextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email (user.email)"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={styles.addActions}>
            <Button variant="default" size="sm" onPress={handleSaveAdd}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onPress={handleCancelAdd}>
              Cancel
            </Button>
          </View>
        </View>
      ) : (
        <View style={styles.addButtonRow}>
          <Button variant="secondary" size="sm" onPress={handleStartAdd}>
            Add identity
          </Button>
        </View>
      )}

      {status ? <Text style={styles.statusText}>{status}</Text> : null}
    </SettingsSection>
  );
}

const styles = StyleSheet.create((theme) => ({
  borderedRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    gap: theme.spacing[3],
  },
  profileText: {
    flex: 1,
    gap: theme.spacing[1],
  },
  profileLabel: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
  },
  profileMeta: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  profileActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
  },
  addCard: {
    marginTop: theme.spacing[3],
    gap: theme.spacing[2],
  },
  input: {
    backgroundColor: theme.colors.surface1,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
  addActions: {
    flexDirection: "row",
    gap: theme.spacing[2],
  },
  addButtonRow: {
    marginTop: theme.spacing[3],
    flexDirection: "row",
  },
  statusText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing[2],
    marginLeft: theme.spacing[1],
  },
}));
