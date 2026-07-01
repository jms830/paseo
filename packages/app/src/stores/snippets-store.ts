// Ported concept from openchamber/openchamber (MIT): reusable snippets inserted in the
// composer via `#` autocomplete. Persisted client-side (AsyncStorage). v1 is a single
// "global" scope; the scope-keyed map leaves room for per-project snippets later.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Snippet {
  id: string;
  name: string;
  body: string;
}

type SnippetsMap = Record<string, Snippet[]>;

interface SnippetsState {
  byScope: SnippetsMap;
}

interface SnippetsActions {
  getSnippets: (scope: string) => Snippet[];
  addSnippet: (scope: string, name: string, body: string) => void;
  updateSnippet: (scope: string, id: string, patch: { name?: string; body?: string }) => void;
  removeSnippet: (scope: string, id: string) => void;
}

type SnippetsStore = SnippetsState & SnippetsActions;

export const GLOBAL_SNIPPET_SCOPE = "global";
export const EMPTY_SNIPPETS: Snippet[] = [];

function createSnippetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `snippet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function snippetsFor(map: SnippetsMap, scope: string): Snippet[] {
  return map[scope] ?? EMPTY_SNIPPETS;
}

function sanitizeMap(value: unknown): SnippetsMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result: SnippetsMap = {};
  for (const [scope, entries] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    const snippets = entries.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const item = entry as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id : "";
      const name = typeof item.name === "string" ? item.name : "";
      const body = typeof item.body === "string" ? item.body : "";
      if (!id || !name) {
        return [];
      }
      return [{ id, name, body } satisfies Snippet];
    });
    if (snippets.length > 0) {
      result[scope] = snippets;
    }
  }
  return result;
}

export const useSnippetsStore = create<SnippetsStore>()(
  persist(
    (set, get) => ({
      byScope: {},

      getSnippets: (scope) => snippetsFor(get().byScope, scope),

      addSnippet: (scope, name, body) => {
        const trimmedName = name.trim();
        if (!scope || !trimmedName) {
          return;
        }
        const current = snippetsFor(get().byScope, scope);
        const snippet: Snippet = { id: createSnippetId(), name: trimmedName, body };
        set((state) => ({
          byScope: { ...state.byScope, [scope]: current.concat(snippet) },
        }));
      },

      updateSnippet: (scope, id, patch) => {
        const current = snippetsFor(get().byScope, scope);
        const next = current.map((snippet) => {
          if (snippet.id !== id) {
            return snippet;
          }
          const trimmedName = patch.name === undefined ? snippet.name : patch.name.trim();
          const body = patch.body === undefined ? snippet.body : patch.body;
          return { id: snippet.id, name: trimmedName || snippet.name, body };
        });
        set((state) => ({ byScope: { ...state.byScope, [scope]: next } }));
      },

      removeSnippet: (scope, id) => {
        const current = snippetsFor(get().byScope, scope);
        set((state) => ({
          byScope: { ...state.byScope, [scope]: current.filter((snippet) => snippet.id !== id) },
        }));
      },
    }),
    {
      name: "snippets",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byScope: state.byScope }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { byScope?: unknown } | undefined;
        return { ...currentState, byScope: sanitizeMap(persisted?.byScope) };
      },
    },
  ),
);
