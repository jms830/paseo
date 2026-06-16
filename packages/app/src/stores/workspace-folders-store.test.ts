import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import {
  useWorkspaceFoldersStore,
  buildWorkspaceFolderScopeKey,
} from "@/stores/workspace-folders-store";

const SCOPE = buildWorkspaceFolderScopeKey("server-1", "/home/me/project");

describe("workspace-folders-store", () => {
  beforeEach(() => {
    useWorkspaceFoldersStore.setState({
      foldersMap: {},
      collapsedFolderIds: new Set(),
    });
  });

  it("builds a scope key from server id and project key", () => {
    expect(buildWorkspaceFolderScopeKey("server-1", "/home/me/project")).toBe(
      "server-1::/home/me/project",
    );
  });

  it("creates folders scoped to a scope key", () => {
    const store = useWorkspaceFoldersStore.getState();
    const folder = store.createFolder(SCOPE, "Backlog");

    expect(folder.name).toBe("Backlog");
    expect(folder.workspaceKeys).toEqual([]);
    expect(useWorkspaceFoldersStore.getState().getFoldersForScope(SCOPE)).toHaveLength(1);
    expect(useWorkspaceFoldersStore.getState().getFoldersForScope("other-scope")).toEqual([]);
  });

  it("moves a workspace into a folder and removes it from any prior folder", () => {
    const store = useWorkspaceFoldersStore.getState();
    const first = store.createFolder(SCOPE, "First");
    const second = store.createFolder(SCOPE, "Second");

    store.addWorkspaceToFolder(SCOPE, first.id, "server-1:ws-a");
    expect(useWorkspaceFoldersStore.getState().getWorkspaceFolderId(SCOPE, "server-1:ws-a")).toBe(
      first.id,
    );

    // Moving to the second folder must remove it from the first.
    store.addWorkspaceToFolder(SCOPE, second.id, "server-1:ws-a");
    const folders = useWorkspaceFoldersStore.getState().getFoldersForScope(SCOPE);
    expect(folders.find((f) => f.id === first.id)?.workspaceKeys).toEqual([]);
    expect(folders.find((f) => f.id === second.id)?.workspaceKeys).toEqual(["server-1:ws-a"]);
  });

  it("removes a workspace from its folder", () => {
    const store = useWorkspaceFoldersStore.getState();
    const folder = store.createFolder(SCOPE, "Folder");
    store.addWorkspaceToFolder(SCOPE, folder.id, "server-1:ws-a");

    store.removeWorkspaceFromFolder(SCOPE, "server-1:ws-a");
    expect(
      useWorkspaceFoldersStore.getState().getWorkspaceFolderId(SCOPE, "server-1:ws-a"),
    ).toBeNull();
  });

  it("renames a folder", () => {
    const store = useWorkspaceFoldersStore.getState();
    const folder = store.createFolder(SCOPE, "Old");
    store.renameFolder(SCOPE, folder.id, "New");

    expect(useWorkspaceFoldersStore.getState().getFoldersForScope(SCOPE)[0]?.name).toBe("New");
  });

  it("deletes a folder and clears its collapsed state", () => {
    const store = useWorkspaceFoldersStore.getState();
    const folder = store.createFolder(SCOPE, "Doomed");
    store.toggleFolderCollapse(folder.id);
    expect(useWorkspaceFoldersStore.getState().collapsedFolderIds.has(folder.id)).toBe(true);

    store.deleteFolder(SCOPE, folder.id);
    expect(useWorkspaceFoldersStore.getState().getFoldersForScope(SCOPE)).toEqual([]);
    expect(useWorkspaceFoldersStore.getState().collapsedFolderIds.has(folder.id)).toBe(false);
  });

  it("cascades deletion to sub-folders", () => {
    const store = useWorkspaceFoldersStore.getState();
    const parent = store.createFolder(SCOPE, "Parent");
    const child = store.createFolder(SCOPE, "Child", parent.id);

    store.deleteFolder(SCOPE, parent.id);
    const remaining = useWorkspaceFoldersStore.getState().getFoldersForScope(SCOPE);
    expect(remaining.find((f) => f.id === child.id)).toBeUndefined();
  });

  it("cleans up workspace keys that no longer exist", () => {
    const store = useWorkspaceFoldersStore.getState();
    const folder = store.createFolder(SCOPE, "Folder");
    store.addWorkspacesToFolder(SCOPE, folder.id, ["server-1:ws-a", "server-1:ws-b"]);

    store.cleanupWorkspaces(SCOPE, new Set(["server-1:ws-a"]));
    expect(useWorkspaceFoldersStore.getState().getFoldersForScope(SCOPE)[0]?.workspaceKeys).toEqual(
      ["server-1:ws-a"],
    );
  });

  it("round-trips through persistence partialize and merge", () => {
    const store = useWorkspaceFoldersStore.getState();
    const folder = store.createFolder(SCOPE, "Persisted");
    store.addWorkspaceToFolder(SCOPE, folder.id, "server-1:ws-a");
    store.toggleFolderCollapse(folder.id);

    const options = useWorkspaceFoldersStore.persist.getOptions();
    const snapshot = options.partialize?.(useWorkspaceFoldersStore.getState());
    const restored = options.merge?.(snapshot, useWorkspaceFoldersStore.getState());

    expect(restored?.foldersMap[SCOPE]?.[0]?.workspaceKeys).toEqual(["server-1:ws-a"]);
    expect(Array.from(restored?.collapsedFolderIds ?? [])).toEqual([folder.id]);
  });
});
