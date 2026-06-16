import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(), removeItem: vi.fn() },
}));

import { buildProjectNotesKey, useProjectNotesStore } from "@/stores/project-notes-store";

const KEY = buildProjectNotesKey("srv", "/home/me/project");

describe("project-notes-store", () => {
  beforeEach(() => {
    useProjectNotesStore.setState({ byKey: {} });
  });

  it("builds a key from server id and cwd", () => {
    expect(buildProjectNotesKey("srv", "/r")).toBe("srv::/r");
  });

  it("returns empty data for an unknown key", () => {
    expect(useProjectNotesStore.getState().getData("missing")).toEqual({ notes: "", todos: [] });
  });

  it("sets notes scoped to a key", () => {
    useProjectNotesStore.getState().setNotes(KEY, "remember this");
    expect(useProjectNotesStore.getState().getData(KEY).notes).toBe("remember this");
    expect(useProjectNotesStore.getState().getData("other").notes).toBe("");
  });

  it("adds, toggles, and removes todos", () => {
    const store = useProjectNotesStore.getState();
    store.addTodo(KEY, "  ship it  ");
    let todos = useProjectNotesStore.getState().getData(KEY).todos;
    expect(todos).toHaveLength(1);
    expect(todos[0].text).toBe("ship it");
    expect(todos[0].done).toBe(false);

    const id = todos[0].id;
    store.toggleTodo(KEY, id);
    expect(useProjectNotesStore.getState().getData(KEY).todos[0].done).toBe(true);

    store.removeTodo(KEY, id);
    expect(useProjectNotesStore.getState().getData(KEY).todos).toEqual([]);
  });

  it("ignores blank todos", () => {
    useProjectNotesStore.getState().addTodo(KEY, "   ");
    expect(useProjectNotesStore.getState().getData(KEY).todos).toEqual([]);
  });

  it("drops malformed entries during persistence merge", () => {
    const options = useProjectNotesStore.persist.getOptions();
    const restored = options.merge?.(
      {
        byKey: {
          good: { notes: "n", todos: [{ id: "1", text: "t", done: true, createdAt: 1 }] },
          bad: { notes: 42, todos: "nope" },
        },
      },
      useProjectNotesStore.getState(),
    );
    expect(restored?.byKey.good?.todos).toHaveLength(1);
    expect(restored?.byKey.bad).toBeUndefined();
  });
});
