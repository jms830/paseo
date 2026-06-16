// Ported from openchamber/openchamber (MIT): packages/web/server/lib/quota/providers/copilot.js
import { getAuthEntry, normalizeAuthEntry, readAuthFile } from "../auth.js";
import { buildResult, toUsageWindow } from "../formatters.js";
import { toNumber, toTimestamp } from "../transformers.js";
import type { UsageWindow } from "@getpaseo/protocol/quota/types";
import type { QuotaProvider } from "./types.js";

const providerId = "github-copilot";
const providerName = "GitHub Copilot";
const aliases = ["github-copilot", "copilot"];

interface CopilotSnapshot {
  entitlement?: unknown;
  remaining?: unknown;
}

interface CopilotPayload {
  quota_snapshots?: {
    chat?: CopilotSnapshot | null;
    completions?: CopilotSnapshot | null;
    premium_interactions?: CopilotSnapshot | null;
  };
  quota_reset_date?: unknown;
}

function buildCopilotWindows(payload: CopilotPayload): Record<string, UsageWindow> {
  const quota = payload?.quota_snapshots ?? {};
  const resetAt = toTimestamp(payload?.quota_reset_date);
  const windows: Record<string, UsageWindow> = {};
  const addWindow = (label: string, snapshot: CopilotSnapshot | null | undefined) => {
    if (!snapshot) {
      return;
    }
    const entitlement = toNumber(snapshot.entitlement);
    const remaining = toNumber(snapshot.remaining);
    const usedPercent =
      entitlement && remaining !== null ? Math.max(0, 100 - (remaining / entitlement) * 100) : null;
    const valueLabel =
      entitlement !== null && remaining !== null
        ? `${remaining.toFixed(0)} / ${entitlement.toFixed(0)} left`
        : null;
    windows[label] = toUsageWindow({ usedPercent, windowSeconds: null, resetAt, valueLabel });
  };
  addWindow("chat", quota.chat);
  addWindow("completions", quota.completions);
  addWindow("premium", quota.premium_interactions);
  return windows;
}

async function fetchCopilotUser(accessToken: string): Promise<CopilotPayload | { error: string }> {
  const response = await fetch("https://api.github.com/copilot_internal/user", {
    method: "GET",
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: "application/json",
      "Editor-Version": "vscode/1.96.2",
      "X-Github-Api-Version": "2025-04-01",
    },
  });
  if (!response.ok) {
    return { error: `API error: ${response.status}` };
  }
  return (await response.json()) as CopilotPayload;
}

export const copilotProvider: QuotaProvider = {
  providerId,
  providerName,
  isConfigured: () => {
    const entry = normalizeAuthEntry(getAuthEntry(readAuthFile(), aliases));
    return Boolean(entry?.access || entry?.token);
  },
  fetchQuota: async () => {
    const entry = normalizeAuthEntry(getAuthEntry(readAuthFile(), aliases));
    const accessToken = entry?.access ?? entry?.token;
    if (!accessToken) {
      return buildResult({
        providerId,
        providerName,
        ok: false,
        configured: false,
        error: "Not configured",
      });
    }
    try {
      const payload = await fetchCopilotUser(accessToken);
      if ("error" in payload) {
        return buildResult({
          providerId,
          providerName,
          ok: false,
          configured: true,
          error: payload.error,
        });
      }
      return buildResult({
        providerId,
        providerName,
        ok: true,
        configured: true,
        usage: { windows: buildCopilotWindows(payload) },
      });
    } catch (error) {
      return buildResult({
        providerId,
        providerName,
        ok: false,
        configured: true,
        error: error instanceof Error ? error.message : "Request failed",
      });
    }
  },
};
