// Ported from openchamber/openchamber (MIT): packages/web/server/lib/quota/providers/claude.js
import { getAuthEntry, normalizeAuthEntry, readAuthFile } from "../auth.js";
import { buildResult, toUsageWindow } from "../formatters.js";
import { toNumber, toTimestamp } from "../transformers.js";
import type { UsageWindow } from "@getpaseo/protocol/quota/types";
import type { QuotaProvider } from "./types.js";

const providerId = "claude";
const providerName = "Claude";
const aliases = ["anthropic", "claude"];

export const claudeProvider: QuotaProvider = {
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
      const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}`, "anthropic-beta": "oauth-2025-04-20" },
      });
      if (!response.ok) {
        return buildResult({
          providerId,
          providerName,
          ok: false,
          configured: true,
          error: `API error: ${response.status}`,
        });
      }
      const payload = (await response.json()) as Record<
        string,
        { utilization?: unknown; resets_at?: unknown } | null
      >;
      const windows: Record<string, UsageWindow> = {};
      const addWindow = (label: string, key: string) => {
        const data = payload?.[key];
        if (data) {
          windows[label] = toUsageWindow({
            usedPercent: toNumber(data.utilization),
            windowSeconds: null,
            resetAt: toTimestamp(data.resets_at),
          });
        }
      };
      addWindow("5h", "five_hour");
      addWindow("7d", "seven_day");
      addWindow("7d-sonnet", "seven_day_sonnet");
      addWindow("7d-opus", "seven_day_opus");
      return buildResult({
        providerId,
        providerName,
        ok: true,
        configured: true,
        usage: { windows },
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
