import { beforeEach, describe, expect, it, vi } from "vitest";

const createAgentMock = vi.fn();

vi.mock("@/stores/session-store", () => ({
  useSessionStore: {
    getState: () => ({ sessions: { srv: { client: { createAgent: createAgentMock } } } }),
  },
}));

vi.mock("@/screens/workspace/workspace-draft-agent-config", () => ({
  buildWorkspaceDraftAgentConfig: (input: Record<string, unknown>) => ({ ...input }),
}));

import { useMultiRunStore } from "@/stores/multi-run-store";

describe("multi-run-store", () => {
  beforeEach(() => {
    useMultiRunStore.setState({ groups: [] });
    createAgentMock.mockReset();
  });

  it("rejects empty prompt and empty model list", async () => {
    await expect(
      useMultiRunStore.getState().launch({
        serverId: "srv",
        cwd: "/r",
        workspaceId: "w",
        prompt: "  ",
        models: [{ provider: "claude", model: "sonnet" }],
      }),
    ).rejects.toThrow("prompt");

    await expect(
      useMultiRunStore.getState().launch({
        serverId: "srv",
        cwd: "/r",
        workspaceId: "w",
        prompt: "hi",
        models: [],
      }),
    ).rejects.toThrow("at least one model");
  });

  it("fires one createAgent per model and records agent ids", async () => {
    createAgentMock.mockImplementation(async (opts: { config: { model: string } }) => ({
      id: `agent-${opts.config.model}`,
    }));

    const group = await useMultiRunStore.getState().launch({
      serverId: "srv",
      cwd: "/r",
      workspaceId: "w",
      prompt: "do it",
      models: [
        { provider: "claude", model: "sonnet" },
        { provider: "codex", model: "gpt-5" },
      ],
    });

    expect(createAgentMock).toHaveBeenCalledTimes(2);
    expect(group.entries).toHaveLength(2);
    expect(group.entries.every((entry) => entry.status === "running")).toBe(true);
    expect(group.entries.map((entry) => entry.agentId).sort()).toEqual([
      "agent-gpt-5",
      "agent-sonnet",
    ]);
    expect(group.prompt).toBe("do it");
  });

  it("marks an entry failed when createAgent rejects", async () => {
    createAgentMock.mockRejectedValue(new Error("boom"));

    const group = await useMultiRunStore.getState().launch({
      serverId: "srv",
      cwd: "/r",
      workspaceId: "w",
      prompt: "do it",
      models: [{ provider: "claude", model: "sonnet" }],
    });

    expect(group.entries[0].status).toBe("failed");
    expect(group.entries[0].error).toBe("boom");
  });

  it("clears groups", async () => {
    createAgentMock.mockResolvedValue({ id: "a" });
    const group = await useMultiRunStore.getState().launch({
      serverId: "srv",
      cwd: "/r",
      workspaceId: "w",
      prompt: "x",
      models: [{ provider: "claude", model: "sonnet" }],
    });
    useMultiRunStore.getState().clearGroup(group.id);
    expect(useMultiRunStore.getState().groups).toEqual([]);
  });
});
