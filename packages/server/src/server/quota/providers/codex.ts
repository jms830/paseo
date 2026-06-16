// Ported from openchamber/openchamber (MIT): packages/web/server/lib/quota/providers/codex.js
import { getAuthEntry, normalizeAuthEntry, readAuthFile } from "../auth.js";
import { buildResult, formatMoney, toUsageWindow } from "../formatters.js";
import { toNumber, toTimestamp } from "../transformers.js";
import type { UsageWindow } from "@getpaseo/protocol/quota/types";
import type { QuotaProvider } from "./types.js";

const providerId = "codex";
const providerName = "Codex";
const aliases = ["openai", "codex", "chatgpt"];

interface RateWindow {
  used_percent?: unknown;
  limit_window_seconds?: unknown;
  reset_at?: unknown;
}

interface CodexPayload {
  rate_limit?: { primary_window?: RateWindow | null; secondary_window?: RateWindow | null };
  credits?: { balance?: unknown; unlimited?: unknown } | null;
}

function resolveCreditsLabel(credits: { balance?: unknown; unlimited?: unknown }): string | null {
  if (credits.unlimited) {
    return "Unlimited";
  }
  const balance = toNumber(credits.balance);
  return balance !== null ? `$${formatMoney(balance)}` : null;
}

function buildCodexWindows(payload: CodexPayload): Record<string, UsageWindow> {
  const windows: Record<string, UsageWindow> = {};
  const primary = payload?.rate_limit?.primary_window ?? null;
  const secondary = payload?.rate_limit?.secondary_window ?? null;
  const credits = payload?.credits ?? null;
  if (primary) {
    windows["5h"] = toUsageWindow({
      usedPercent: toNumber(primary.used_percent),
      windowSeconds: toNumber(primary.limit_window_seconds),
      resetAt: toTimestamp(primary.reset_at),
    });
  }
  if (secondary) {
    windows.weekly = toUsageWindow({
      usedPercent: toNumber(secondary.used_percent),
      windowSeconds: toNumber(secondary.limit_window_seconds),
      resetAt: toTimestamp(secondary.reset_at),
    });
  }
  if (credits) {
    windows.credits_balance = toUsageWindow({
      usedPercent: null,
      windowSeconds: null,
      resetAt: null,
      valueLabel: resolveCreditsLabel(credits),
    });
  }
  return windows;
}

export const codexProvider: QuotaProvider = {
  providerId,
  providerName,
  isConfigured: () => {
    const entry = normalizeAuthEntry(getAuthEntry(readAuthFile(), aliases));
    return Boolean(entry?.access || entry?.token);
  },
  fetchQuota: async () => {
    const entry = normalizeAuthEntry(getAuthEntry(readAuthFile(), aliases));
    const accessToken = entry?.access ?? entry?.token;
    const accountId = typeof entry?.accountId === "string" ? entry.accountId : undefined;
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
      const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(accountId ? { "ChatGPT-Account-Id": accountId } : {}),
        },
      });
      if (!response.ok) {
        return buildResult({
          providerId,
          providerName,
          ok: false,
          configured: true,
          error:
            response.status === 401
              ? "Session expired \u2014 please re-authenticate with OpenAI"
              : `API error: ${response.status}`,
        });
      }
      const payload = (await response.json()) as CodexPayload;
      return buildResult({
        providerId,
        providerName,
        ok: true,
        configured: true,
        usage: { windows: buildCodexWindows(payload) },
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
