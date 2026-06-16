// Ported concept from openchamber/openchamber (MIT): ProjectNotesTodoPanel.
// Per-project scratchpad: free-form notes + a todo checklist. Backed by project-notes-store.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { Check, Plus, Square, Trash2 } from "lucide-react-native";
import type { Theme } from "@/styles/theme";
import {
  buildProjectNotesKey,
  useProjectNotesStore,
  type ProjectTodo,
} from "@/stores/project-notes-store";
import { useI18n } from "@/lib/i18n";

const ThemedTextInput = withUnistyles(TextInput, (theme) => ({
  placeholderTextColor: theme.colors.foregroundMuted,
}));
const ThemedCheck = withUnistyles(Check);
const ThemedSquare = withUnistyles(Square);
const ThemedTrash = withUnistyles(Trash2);
const ThemedPlus = withUnistyles(Plus);

const mutedColor = (theme: Theme) => ({ color: theme.colors.foregroundMuted });
const accentColor = (theme: Theme) => ({ color: theme.colors.accent });

interface ProjectNotesPanelProps {
  serverId: string;
  cwd: string;
  active?: boolean;
}

function TodoRow({
  todo,
  onToggle,
  onRemove,
}: {
  todo: ProjectTodo;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const handleToggle = useCallback(() => onToggle(todo.id), [onToggle, todo.id]);
  const handleRemove = useCallback(() => onRemove(todo.id), [onRemove, todo.id]);
  const checkedState = useMemo(() => ({ checked: todo.done }), [todo.done]);
  return (
    <View style={styles.todoRow}>
      <Pressable
        onPress={handleToggle}
        hitSlop={8}
        style={styles.todoCheck}
        accessibilityRole="checkbox"
        accessibilityState={checkedState}
        testID={`project-todo-toggle-${todo.id}`}
      >
        {todo.done ? (
          <ThemedCheck size={16} uniProps={accentColor} />
        ) : (
          <ThemedSquare size={16} uniProps={mutedColor} />
        )}
      </Pressable>
      <Text style={todo.done ? styles.todoTextDone : styles.todoText}>{todo.text}</Text>
      <Pressable
        onPress={handleRemove}
        hitSlop={8}
        style={styles.todoDelete}
        accessibilityLabel="Delete todo"
        testID={`project-todo-delete-${todo.id}`}
      >
        <ThemedTrash size={14} uniProps={mutedColor} />
      </Pressable>
    </View>
  );
}

export function ProjectNotesPanel({ serverId, cwd, active = true }: ProjectNotesPanelProps) {
  const { t } = useI18n();
  const key = buildProjectNotesKey(serverId, cwd);
  const selectData = useCallback(
    (state: { byKey: Record<string, { notes: string; todos: ProjectTodo[] }> }) => state.byKey[key],
    [key],
  );
  const data = useProjectNotesStore(selectData);
  const setNotes = useProjectNotesStore((state) => state.setNotes);
  const addTodo = useProjectNotesStore((state) => state.addTodo);
  const toggleTodo = useProjectNotesStore((state) => state.toggleTodo);
  const removeTodo = useProjectNotesStore((state) => state.removeTodo);

  const notes = data?.notes ?? "";
  const todos = data?.todos ?? EMPTY_TODOS;

  const [notesDraft, setNotesDraft] = useState(notes);
  const [todoDraft, setTodoDraft] = useState("");

  useEffect(() => {
    setNotesDraft(notes);
  }, [notes]);

  const handleNotesBlur = useCallback(() => {
    if (notesDraft !== notes) {
      setNotes(key, notesDraft);
    }
  }, [notesDraft, notes, setNotes, key]);

  const handleAddTodo = useCallback(() => {
    const trimmed = todoDraft.trim();
    if (!trimmed) {
      return;
    }
    addTodo(key, trimmed);
    setTodoDraft("");
  }, [addTodo, key, todoDraft]);

  const handleToggle = useCallback((id: string) => toggleTodo(key, id), [toggleTodo, key]);
  const handleRemove = useCallback((id: string) => removeTodo(key, id), [removeTodo, key]);

  if (!active) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>{t("projectNotes.notes")}</Text>
      <ThemedTextInput
        style={styles.notesInput}
        value={notesDraft}
        onChangeText={setNotesDraft}
        onBlur={handleNotesBlur}
        placeholder={t("projectNotes.notesPlaceholder")}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.sectionLabel}>{t("projectNotes.todos")}</Text>
      <View style={styles.addRow}>
        <ThemedTextInput
          style={styles.todoInput}
          value={todoDraft}
          onChangeText={setTodoDraft}
          onSubmitEditing={handleAddTodo}
          placeholder={t("projectNotes.todoPlaceholder")}
          returnKeyType="done"
        />
        <Pressable
          onPress={handleAddTodo}
          style={styles.addButton}
          accessibilityLabel="Add todo"
          testID="project-todo-add"
        >
          <ThemedPlus size={16} uniProps={mutedColor} />
        </Pressable>
      </View>

      {todos.length === 0 ? (
        <Text style={styles.emptyText}>{t("projectNotes.empty")}</Text>
      ) : (
        todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} onToggle={handleToggle} onRemove={handleRemove} />
        ))
      )}
    </ScrollView>
  );
}

const EMPTY_TODOS: ProjectTodo[] = [];

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface0,
  },
  content: {
    padding: theme.spacing[3],
    gap: theme.spacing[2],
  },
  sectionLabel: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    marginTop: theme.spacing[2],
  },
  notesInput: {
    minHeight: 120,
    backgroundColor: theme.colors.surface1,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing[3],
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  todoInput: {
    flex: 1,
    backgroundColor: theme.colors.surface1,
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
  addButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.surface2,
  },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[1],
  },
  todoCheck: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  todoText: {
    flex: 1,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
  todoTextDone: {
    flex: 1,
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    textDecorationLine: "line-through",
  },
  todoDelete: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
}));
