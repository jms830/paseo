// Ported concept from openchamber/openchamber (MIT): openchamberConfig project notes/todos +
// ProjectNotesTodoPanel. Per-project scratchpad (free-form notes + a todo checklist), persisted
// client-side (AsyncStorage), keyed by `${serverId}::${cwd}` (matches sidebar store conventions).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface ProjectTodo {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export interface ProjectNotesData {
  notes: string;
  todos: ProjectTodo[];
}

type ProjectNotesMap = Record<string, ProjectNotesData>;

interface ProjectNotesState {
  byKey: ProjectNotesMap;
}

interface ProjectNotesActions {
  getData: (key: string) => ProjectNotesData;
  setNotes: (key: string, notes: string) => void;
  addTodo: (key: string, text: string) => void;
  toggleTodo: (key: string, todoId: string) => void;
  removeTodo: (key: string, todoId: string) => void;
}

type ProjectNotesStore = ProjectNotesState & ProjectNotesActions;

const EMPTY_DATA: ProjectNotesData = { notes: "", todos: [] };

export function buildProjectNotesKey(serverId: string, cwd: string): string {
  return `${serverId.trim()}::${cwd.trim()}`;
}

function createTodoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function dataFor(map: ProjectNotesMap, key: string): ProjectNotesData {
  return map[key] ?? EMPTY_DATA;
}

function sanitizeMap(value: unknown): ProjectNotesMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result: ProjectNotesMap = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as Record<string, unknown>;
    const notes = typeof candidate.notes === "string" ? candidate.notes : "";
    const todos = Array.isArray(candidate.todos)
      ? (candidate.todos as unknown[]).flatMap((todo) => {
          if (!todo || typeof todo !== "object") {
            return [];
          }
          const item = todo as Record<string, unknown>;
          const id = typeof item.id === "string" ? item.id : "";
          const text = typeof item.text === "string" ? item.text : "";
          if (!id || !text) {
            return [];
          }
          return [
            {
              id,
              text,
              done: item.done === true,
              createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
            } satisfies ProjectTodo,
          ];
        })
      : [];
    if (notes || todos.length > 0) {
      result[key] = { notes, todos };
    }
  }
  return result;
}

export const useProjectNotesStore = create<ProjectNotesStore>()(
  persist(
    (set, get) => ({
      byKey: {},

      getData: (key) => dataFor(get().byKey, key),

      setNotes: (key, notes) => {
        if (!key) {
          return;
        }
        const current = dataFor(get().byKey, key);
        set((state) => ({ byKey: { ...state.byKey, [key]: { ...current, notes } } }));
      },

      addTodo: (key, text) => {
        const trimmed = text.trim();
        if (!key || !trimmed) {
          return;
        }
        const current = dataFor(get().byKey, key);
        const todo: ProjectTodo = {
          id: createTodoId(),
          text: trimmed,
          done: false,
          createdAt: Date.now(),
        };
        set((state) => ({
          byKey: { ...state.byKey, [key]: { ...current, todos: current.todos.concat(todo) } },
        }));
      },

      toggleTodo: (key, todoId) => {
        const current = dataFor(get().byKey, key);
        const todos = current.todos.map((todo) =>
          todo.id === todoId ? Object.assign({}, todo, { done: !todo.done }) : todo,
        );
        set((state) => ({ byKey: { ...state.byKey, [key]: { ...current, todos } } }));
      },

      removeTodo: (key, todoId) => {
        const current = dataFor(get().byKey, key);
        const todos = current.todos.filter((todo) => todo.id !== todoId);
        set((state) => ({ byKey: { ...state.byKey, [key]: { ...current, todos } } }));
      },
    }),
    {
      name: "project-notes",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byKey: state.byKey }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { byKey?: unknown } | undefined;
        return { ...currentState, byKey: sanitizeMap(persisted?.byKey) };
      },
    },
  ),
);
