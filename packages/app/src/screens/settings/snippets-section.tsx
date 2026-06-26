// Ported concept from openchamber/openchamber (MIT): reusable composer snippets.
// Manages the global snippet list (insert via `#` in the composer). Persisted
// client-side via snippets-store.
import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/screens/settings/settings-section";
import { settingsStyles } from "@/styles/settings";
import { useI18n } from "@/lib/i18n";
import { GLOBAL_SNIPPET_SCOPE, useSnippetsStore, type Snippet } from "@/stores/snippets-store";

const ThemedTextInput = withUnistyles(TextInput, (theme) => ({
  placeholderTextColor: theme.colors.foregroundMuted,
}));

function SnippetRow({
  snippet,
  onEdit,
  onRemove,
}: {
  snippet: Snippet;
  onEdit: (snippet: Snippet) => void;
  onRemove: (id: string) => void;
}) {
  const handleEdit = useCallback(() => onEdit(snippet), [onEdit, snippet]);
  const handleRemove = useCallback(() => onRemove(snippet.id), [onRemove, snippet.id]);
  return (
    <View style={styles.row}>
      <Pressable style={styles.rowMain} onPress={handleEdit} testID={`snippet-edit-${snippet.id}`}>
        <Text style={styles.rowName}>{`#${snippet.name}`}</Text>
        <Text style={styles.rowBody} numberOfLines={1}>
          {snippet.body}
        </Text>
      </Pressable>
      <Pressable
        style={styles.removeButton}
        onPress={handleRemove}
        testID={`snippet-remove-${snippet.id}`}
      >
        <Text style={styles.removeText}>×</Text>
      </Pressable>
    </View>
  );
}

export function SnippetsSection() {
  const { t } = useI18n();
  const selectSnippets = useCallback(
    (state: { byScope: Record<string, Snippet[]> }) => state.byScope[GLOBAL_SNIPPET_SCOPE],
    [],
  );
  const stored = useSnippetsStore(selectSnippets);
  const addSnippet = useSnippetsStore((state) => state.addSnippet);
  const updateSnippet = useSnippetsStore((state) => state.updateSnippet);
  const removeSnippet = useSnippetsStore((state) => state.removeSnippet);
  const snippets = useMemo(() => stored ?? EMPTY, [stored]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");

  const resetForm = useCallback(() => {
    setEditingId(null);
    setNameDraft("");
    setBodyDraft("");
  }, []);

  const handleEdit = useCallback((snippet: Snippet) => {
    setEditingId(snippet.id);
    setNameDraft(snippet.name);
    setBodyDraft(snippet.body);
  }, []);

  const handleSave = useCallback(() => {
    const name = nameDraft.trim();
    if (!name) {
      return;
    }
    if (editingId) {
      updateSnippet(GLOBAL_SNIPPET_SCOPE, editingId, { name, body: bodyDraft });
    } else {
      addSnippet(GLOBAL_SNIPPET_SCOPE, name, bodyDraft);
    }
    resetForm();
  }, [addSnippet, bodyDraft, editingId, nameDraft, resetForm, updateSnippet]);

  const handleRemove = useCallback(
    (id: string) => {
      removeSnippet(GLOBAL_SNIPPET_SCOPE, id);
      if (editingId === id) {
        resetForm();
      }
    },
    [editingId, removeSnippet, resetForm],
  );

  return (
    <SettingsSection title={t("snippets.title")}>
      <View style={settingsStyles.card}>
        <Text style={styles.hint}>{t("snippets.hint")}</Text>
        {snippets.length === 0 ? (
          <Text style={styles.empty}>{t("snippets.empty")}</Text>
        ) : (
          snippets.map((snippet) => (
            <SnippetRow
              key={snippet.id}
              snippet={snippet}
              onEdit={handleEdit}
              onRemove={handleRemove}
            />
          ))
        )}
        <ThemedTextInput
          style={styles.nameInput}
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder={t("snippets.namePlaceholder")}
          autoCapitalize="none"
          testID="snippet-name-input"
        />
        <ThemedTextInput
          style={styles.bodyInput}
          value={bodyDraft}
          onChangeText={setBodyDraft}
          placeholder={t("snippets.bodyPlaceholder")}
          multiline
          textAlignVertical="top"
          testID="snippet-body-input"
        />
        <View style={styles.actions}>
          {editingId ? (
            <Button variant="ghost" onPress={resetForm}>
              {t("snippets.cancel")}
            </Button>
          ) : null}
          <Button onPress={handleSave} testID="snippet-save">
            {editingId ? t("snippets.save") : t("snippets.add")}
          </Button>
        </View>
      </View>
    </SettingsSection>
  );
}

const EMPTY: Snippet[] = [];

const styles = StyleSheet.create((theme) => ({
  hint: {
    color: theme.colors.foregroundMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  empty: {
    color: theme.colors.foregroundMuted,
    fontSize: 13,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    color: theme.colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  rowBody: {
    color: theme.colors.foregroundMuted,
    fontSize: 12,
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  removeText: {
    color: theme.colors.foregroundMuted,
    fontSize: 20,
  },
  nameInput: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: theme.colors.foreground,
  },
  bodyInput: {
    marginTop: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: theme.colors.foreground,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
}));
