// Ported from openchamber/openchamber (MIT): packages/web/server/lib/quota/providers/openrouter.js
import { getAuthEntry, normalizeAuthEntry, readAuthFile } from "../auth.js";
import { buildResult, formatMoney, toUsageWindow } from "../formatters.js";
import { toNumber } from "../transformers.js";
import type { UsageWindow } from "@getpaseo/protocol/quota/types";
import type { QuotaProvider } from "./types.js";

const providerId = "openrouter";
const providerName = "OpenRouter";
const aliases = ["openrouter"];

export const openrouterProvider: QuotaProvider = {
  providerId,
  providerName,
  isConfigured: () => {
    const entry = normalizeAuthEntry(getAuthEntry(readAuthFile(), aliases));
    return Boolean(entry?.key || entry?.token);
  },
  fetchQuota: async () => {
    const entry = normalizeAuthEntry(getAuthEntry(readAuthFile(), aliases));
    const apiKey = entry?.key ?? entry?.token;
    if (!apiKey) {
      return buildResult({
        providerId,
        providerName,
        ok: false,
        configured: false,
        error: "Not configured",
      });
    }
    try {
      const response = await fetch("https://openrouter.ai/api/v1/credits", {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
      const payload = (await response.json()) as {
        data?: { total_credits?: unknown; total_usage?: unknown };
      };
      const credits = payload?.data ?? {};
      const totalCredits = toNumber(credits.total_credits);
      const totalUsage = toNumber(credits.total_usage);
      const remaining =
        totalCredits !== null && totalUsage !== null
          ? Math.max(0, totalCredits - totalUsage)
          : null;
      const valueLabel =
        remaining !== null && totalUsage !== null
          ? `$${formatMoney(remaining)} left · $${formatMoney(totalUsage)} spent`
          : null;
      const windows: Record<string, UsageWindow> = {
        credits: toUsageWindow({
          usedPercent: null,
          windowSeconds: null,
          resetAt: null,
          valueLabel,
        }),
      };
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
