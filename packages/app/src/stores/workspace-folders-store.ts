// Ported from openchamber/openchamber (MIT): packages/ui/src/stores/useSessionFoldersStore.ts
// Adapted to Paseo conventions: AsyncStorage + zustand persist (client-only, matching
// sidebar-order-store / sidebar-collapsed-sections-store) instead of localStorage + server route.
//
// Concept mapping (OpenChamber -> Paseo):
//   - "session folder" -> workspace folder (the draggable unit in Paseo is a workspace)
//   - scopeKey         -> `${serverId}::${projectKey}` (same shape as sidebar-order-store)
//   - sessionId        -> workspaceKey (`${serverId}:${workspaceId}`)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface WorkspaceFolder {
  id: string;
  name: string;
  /** Workspace keys (`${serverId}:${workspaceId}`) that belong to this folder. */
  workspaceKeys: string[];
  createdAt: number;
  /** If set, this folder is a sub-folder of the parent folder with this id. */
  parentId?: string | null;
}

export type WorkspaceFoldersMap = Record<string, WorkspaceFolder[]>;

interface WorkspaceFoldersState {
  foldersMap: WorkspaceFoldersMap;
  collapsedFolderIds: Set<string>;
}

interface WorkspaceFoldersActions {
  getFoldersForScope: (scopeKey: string) => WorkspaceFolder[];
  createFolder: (scopeKey: string, name: string, parentId?: string | null) => WorkspaceFolder;
  renameFolder: (scopeKey: string, folderId: string, name: string) => void;
  deleteFolder: (scopeKey: string, folderId: string) => void;
  addWorkspaceToFolder: (scopeKey: string, folderId: string, workspaceKey: string) => void;
  addWorkspacesToFolder: (scopeKey: string, folderId: string, workspaceKeys: string[]) => void;
  removeWorkspaceFromFolder: (scopeKey: string, workspaceKey: string) => void;
  removeWorkspacesFromFolders: (scopeKey: string, workspaceKeys: string[]) => void;
  toggleFolderCollapse: (folderId: string) => void;
  cleanupWorkspaces: (scopeKey: string, existingWorkspaceKeys: Set<string>) => void;
  getWorkspaceFolderId: (scopeKey: string, workspaceKey: string) => string | null;
}

type WorkspaceFoldersStore = WorkspaceFoldersState & WorkspaceFoldersActions;

export function buildWorkspaceFolderScopeKey(serverId: string, projectKey: string): string {
  return `${serverId.trim()}::${projectKey.trim()}`;
}

function createFolderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Returns a folder copy whose workspaceKeys are replaced with `keys`. */
function withWorkspaceKeys(folder: WorkspaceFolder, keys: string[]): WorkspaceFolder {
  return Object.assign({}, folder, { workspaceKeys: keys });
}

function syncCollapsedAfterFolderCleanup(
  prevFolders: WorkspaceFolder[],
  nextFolders: WorkspaceFolder[],
  collapsedFolderIds: Set<string>,
): Set<string> | null {
  const nextFolderIds = new Set(nextFolders.map((folder) => folder.id));
  let nextCollapsed: Set<string> | null = null;

  for (const folder of prevFolders) {
    if (!nextFolderIds.has(folder.id) && collapsedFolderIds.has(folder.id)) {
      if (!nextCollapsed) {
        nextCollapsed = new Set(collapsedFolderIds);
      }
      nextCollapsed.delete(folder.id);
    }
  }

  return nextCollapsed;
}

interface PersistedWorkspaceFoldersState {
  foldersMap?: WorkspaceFoldersMap;
  collapsedFolderIds?: string[];
}

function sanitizeFoldersMap(value: unknown): WorkspaceFoldersMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result: WorkspaceFoldersMap = {};
  for (const [scopeKey, entries] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    const folders: WorkspaceFolder[] = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const candidate = entry as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const createdAt = typeof candidate.createdAt === "number" ? candidate.createdAt : 0;
      if (!id || !name) {
        continue;
      }
      const workspaceKeys = Array.isArray(candidate.workspaceKeys)
        ? (candidate.workspaceKeys as unknown[]).filter(
            (v): v is string => typeof v === "string" && v.trim().length > 0,
          )
        : [];
      const parentId = typeof candidate.parentId === "string" ? candidate.parentId : null;
      folders.push({ id, name, workspaceKeys, createdAt, parentId });
    }
    if (folders.length > 0) {
      result[scopeKey] = folders;
    }
  }
  return result;
}

export const useWorkspaceFoldersStore = create<WorkspaceFoldersStore>()(
  persist(
    (set, get) => ({
      foldersMap: {},
      collapsedFolderIds: new Set<string>(),

      getFoldersForScope: (scopeKey) => {
        if (!scopeKey) {
          return [];
        }
        return get().foldersMap[scopeKey] ?? [];
      },

      createFolder: (scopeKey, name, parentId) => {
        const trimmed = name.trim() || "New folder";
        const folder: WorkspaceFolder = {
          id: createFolderId(),
          name: trimmed,
          workspaceKeys: [],
          createdAt: Date.now(),
          parentId: parentId ?? null,
        };
        const current = get().foldersMap;
        const scopeFolders = current[scopeKey] ?? [];
        set({ foldersMap: { ...current, [scopeKey]: scopeFolders.concat(folder) } });
        return folder;
      },

      renameFolder: (scopeKey, folderId, name) => {
        const trimmed = name.trim();
        if (!trimmed || !scopeKey) {
          return;
        }
        const current = get().foldersMap;
        const scopeFolders = current[scopeKey];
        if (!scopeFolders) {
          return;
        }
        const nextFolders = scopeFolders.map((folder) =>
          folder.id === folderId ? Object.assign({}, folder, { name: trimmed }) : folder,
        );
        set({ foldersMap: { ...current, [scopeKey]: nextFolders } });
      },

      deleteFolder: (scopeKey, folderId) => {
        if (!scopeKey) {
          return;
        }
        const current = get().foldersMap;
        const scopeFolders = current[scopeKey];
        if (!scopeFolders) {
          return;
        }
        // Cascade delete: also remove all sub-folders of this folder.
        const idsToDelete = new Set<string>([folderId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const f of scopeFolders) {
            if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
              idsToDelete.add(f.id);
              changed = true;
            }
          }
        }
        const nextFolders = scopeFolders.filter((folder) => !idsToDelete.has(folder.id));
        const nextMap = { ...current, [scopeKey]: nextFolders };

        const collapsed = get().collapsedFolderIds;
        const hasStale = Array.from(idsToDelete).some((id) => collapsed.has(id));
        if (hasStale) {
          const nextCollapsed = new Set(collapsed);
          idsToDelete.forEach((id) => nextCollapsed.delete(id));
          set({ foldersMap: nextMap, collapsedFolderIds: nextCollapsed });
        } else {
          set({ foldersMap: nextMap });
        }
      },

      addWorkspaceToFolder: (scopeKey, folderId, workspaceKey) => {
        if (!scopeKey || !folderId || !workspaceKey) {
          return;
        }
        get().addWorkspacesToFolder(scopeKey, folderId, [workspaceKey]);
      },

      addWorkspacesToFolder: (scopeKey, folderId, workspaceKeys) => {
        if (!scopeKey || !folderId || workspaceKeys.length === 0) {
          return;
        }
        const current = get().foldersMap;
        const scopeFolders = current[scopeKey];
        if (!scopeFolders) {
          return;
        }
        const idSet = new Set(
          workspaceKeys.filter((id) => typeof id === "string" && id.length > 0),
        );
        if (idSet.size === 0) {
          return;
        }
        const added = Array.from(idSet);
        const nextFolders = scopeFolders.map((folder) => {
          const without = folder.workspaceKeys.filter((id) => !idSet.has(id));
          if (folder.id === folderId) {
            return withWorkspaceKeys(folder, without.concat(added));
          }
          if (without.length !== folder.workspaceKeys.length) {
            return withWorkspaceKeys(folder, without);
          }
          return folder;
        });
        const nextMap = { ...current, [scopeKey]: nextFolders };
        const nextCollapsed = syncCollapsedAfterFolderCleanup(
          scopeFolders,
          nextFolders,
          get().collapsedFolderIds,
        );
        set(
          nextCollapsed
            ? { foldersMap: nextMap, collapsedFolderIds: nextCollapsed }
            : { foldersMap: nextMap },
        );
      },

      removeWorkspaceFromFolder: (scopeKey, workspaceKey) => {
        if (!scopeKey || !workspaceKey) {
          return;
        }
        get().removeWorkspacesFromFolders(scopeKey, [workspaceKey]);
      },

      removeWorkspacesFromFolders: (scopeKey, workspaceKeys) => {
        if (!scopeKey || workspaceKeys.length === 0) {
          return;
        }
        const current = get().foldersMap;
        const scopeFolders = current[scopeKey];
        if (!scopeFolders) {
          return;
        }
        const idSet = new Set(
          workspaceKeys.filter((id) => typeof id === "string" && id.length > 0),
        );
        if (idSet.size === 0) {
          return;
        }
        let changed = false;
        const nextFolders = scopeFolders.map((folder) => {
          const filtered = folder.workspaceKeys.filter((id) => !idSet.has(id));
          if (filtered.length !== folder.workspaceKeys.length) {
            changed = true;
            return withWorkspaceKeys(folder, filtered);
          }
          return folder;
        });
        if (!changed) {
          return;
        }
        const nextMap = { ...current, [scopeKey]: nextFolders };
        const nextCollapsed = syncCollapsedAfterFolderCleanup(
          scopeFolders,
          nextFolders,
          get().collapsedFolderIds,
        );
        set(
          nextCollapsed
            ? { foldersMap: nextMap, collapsedFolderIds: nextCollapsed }
            : { foldersMap: nextMap },
        );
      },

      toggleFolderCollapse: (folderId) => {
        const collapsed = get().collapsedFolderIds;
        const next = new Set(collapsed);
        if (next.has(folderId)) {
          next.delete(folderId);
        } else {
          next.add(folderId);
        }
        set({ collapsedFolderIds: next });
      },

      cleanupWorkspaces: (scopeKey, existingWorkspaceKeys) => {
        if (!scopeKey) {
          return;
        }
        const current = get().foldersMap;
        const scopeFolders = current[scopeKey];
        if (!scopeFolders || scopeFolders.length === 0) {
          return;
        }
        let changed = false;
        const nextFolders = scopeFolders.map((folder) => {
          const filtered = folder.workspaceKeys.filter((id) => existingWorkspaceKeys.has(id));
          if (filtered.length !== folder.workspaceKeys.length) {
            changed = true;
            return withWorkspaceKeys(folder, filtered);
          }
          return folder;
        });
        if (!changed) {
          return;
        }
        const nextMap = { ...current, [scopeKey]: nextFolders };
        const nextCollapsed = syncCollapsedAfterFolderCleanup(
          scopeFolders,
          nextFolders,
          get().collapsedFolderIds,
        );
        set(
          nextCollapsed
            ? { foldersMap: nextMap, collapsedFolderIds: nextCollapsed }
            : { foldersMap: nextMap },
        );
      },

      getWorkspaceFolderId: (scopeKey, workspaceKey) => {
        if (!scopeKey || !workspaceKey) {
          return null;
        }
        const scopeFolders = get().foldersMap[scopeKey];
        if (!scopeFolders) {
          return null;
        }
        for (const folder of scopeFolders) {
          if (folder.workspaceKeys.includes(workspaceKey)) {
            return folder.id;
          }
        }
        return null;
      },
    }),
    {
      name: "workspace-folders",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        foldersMap: state.foldersMap,
        collapsedFolderIds: Array.from(state.collapsedFolderIds),
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as PersistedWorkspaceFoldersState | undefined;
        if (!persisted) {
          return currentState;
        }
        return {
          ...currentState,
          foldersMap: sanitizeFoldersMap(persisted.foldersMap),
          collapsedFolderIds: Array.isArray(persisted.collapsedFolderIds)
            ? new Set(
                persisted.collapsedFolderIds.filter((v): v is string => typeof v === "string"),
              )
            : new Set<string>(),
        };
      },
    },
  ),
);
