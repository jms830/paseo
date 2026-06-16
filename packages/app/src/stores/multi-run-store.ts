// Ported concept from openchamber/openchamber (MIT): useMultiRunStore.
// Launches the same prompt across multiple (provider, model) pairs in parallel by firing one
// createAgent per pair into a workspace, tracking each as a run entry. Ephemeral (not persisted).
import { create } from "zustand";
import type { AgentProvider } from "@getpaseo/protocol/agent-types";
import { useSessionStore } from "@/stores/session-store";
import { buildWorkspaceDraftAgentConfig } from "@/screens/workspace/workspace-draft-agent-config";

export interface MultiRunModelSelection {
  provider: AgentProvider;
  model: string;
}

export type MultiRunEntryStatus = "pending" | "running" | "failed";

export interface MultiRunEntry {
  id: string;
  provider: AgentProvider;
  model: string;
  status: MultiRunEntryStatus;
  agentId: string | null;
  error: string | null;
}

export interface MultiRunGroup {
  id: string;
  prompt: string;
  cwd: string;
  serverId: string;
  workspaceId: string;
  entries: MultiRunEntry[];
  createdAt: number;
}

export interface LaunchMultiRunInput {
  serverId: string;
  cwd: string;
  workspaceId: string;
  prompt: string;
  models: MultiRunModelSelection[];
}

interface MultiRunState {
  groups: MultiRunGroup[];
}

interface MultiRunActions {
  launch: (input: LaunchMultiRunInput) => Promise<MultiRunGroup>;
  clearGroup: (groupId: string) => void;
  clearAll: () => void;
}

type MultiRunStore = MultiRunState & MultiRunActions;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function patchGroupEntry(
  group: MultiRunGroup,
  entryId: string,
  patch: Partial<MultiRunEntry>,
): MultiRunGroup {
  return Object.assign({}, group, {
    entries: group.entries.map((entry) =>
      entry.id === entryId ? Object.assign({}, entry, patch) : entry,
    ),
  });
}

function resolveClient(serverId: string) {
  const client = useSessionStore.getState().sessions[serverId]?.client ?? null;
  if (!client) {
    throw new Error("Daemon client unavailable");
  }
  return client;
}

export const useMultiRunStore = create<MultiRunStore>()((set, get) => ({
  groups: [],

  launch: async (input) => {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new Error("A prompt is required");
    }
    if (input.models.length === 0) {
      throw new Error("Select at least one model");
    }

    const groupId = createId("multirun");
    const entries: MultiRunEntry[] = input.models.map((selection) => ({
      id: createId("entry"),
      provider: selection.provider,
      model: selection.model,
      status: "pending",
      agentId: null,
      error: null,
    }));
    const group: MultiRunGroup = {
      id: groupId,
      prompt,
      cwd: input.cwd,
      serverId: input.serverId,
      workspaceId: input.workspaceId,
      entries,
      createdAt: Date.now(),
    };
    set((state) => ({ groups: state.groups.concat(group) }));

    const updateEntry = (entryId: string, patch: Partial<MultiRunEntry>) => {
      set((state) => ({
        groups: state.groups.map((existing) =>
          existing.id === groupId ? patchGroupEntry(existing, entryId, patch) : existing,
        ),
      }));
    };

    const client = resolveClient(input.serverId);
    await Promise.all(
      entries.map(async (entry) => {
        try {
          const config = buildWorkspaceDraftAgentConfig({
            provider: entry.provider,
            cwd: input.cwd,
            model: entry.model,
          });
          const result = await client.createAgent({
            config,
            workspaceId: input.workspaceId,
            initialPrompt: prompt,
          });
          updateEntry(entry.id, { status: "running", agentId: result.id });
        } catch (error) {
          updateEntry(entry.id, {
            status: "failed",
            error: error instanceof Error ? error.message : "Failed to launch",
          });
        }
      }),
    );

    return get().groups.find((existing) => existing.id === groupId) ?? group;
  },

  clearGroup: (groupId) => {
    set((state) => ({ groups: state.groups.filter((group) => group.id !== groupId) }));
  },

  clearAll: () => {
    set({ groups: [] });
  },
}));
