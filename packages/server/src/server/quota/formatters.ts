// Ported from openchamber/openchamber (MIT): packages/web/server/lib/quota/utils/formatters.js
import type { ProviderResult, ProviderUsage, UsageWindow } from "@getpaseo/protocol/quota/types";

export function formatResetTime(timestamp: number): string | null {
  try {
    const resetDate = new Date(timestamp);
    if (!Number.isFinite(resetDate.getTime())) {
      return null;
    }
    const now = new Date();
    const isToday = resetDate.toDateString() === now.toDateString();
    if (isToday) {
      return resetDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    return resetDate.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export function calculateResetAfterSeconds(resetAt: number | null): number | null {
  if (resetAt === null || resetAt === undefined) {
    return null;
  }
  const resetAtTime = new Date(resetAt).getTime();
  if (!Number.isFinite(resetAtTime)) {
    return null;
  }
  const delta = Math.floor((resetAtTime - Date.now()) / 1000);
  return delta < 0 ? 0 : delta;
}

export function toUsageWindow(input: {
  usedPercent: number | null;
  windowSeconds: number | null;
  resetAt: number | null;
  valueLabel?: string | null;
}): UsageWindow {
  const { usedPercent, windowSeconds, resetAt, valueLabel } = input;
  const resetAfterSeconds = calculateResetAfterSeconds(resetAt);
  const resetFormatted =
    resetAt !== null && resetAt !== undefined ? formatResetTime(resetAt) : null;
  const hasFiniteUsedPercent = typeof usedPercent === "number" && Number.isFinite(usedPercent);
  return {
    usedPercent,
    remainingPercent: hasFiniteUsedPercent ? Math.max(0, 100 - usedPercent) : null,
    windowSeconds: windowSeconds ?? null,
    resetAfterSeconds,
    resetAt,
    resetAtFormatted: resetFormatted,
    resetAfterFormatted: resetFormatted,
    valueLabel: valueLabel ?? null,
  };
}

export function buildResult(input: {
  providerId: string;
  providerName: string;
  ok: boolean;
  configured: boolean;
  usage?: ProviderUsage | null;
  error?: string;
}): ProviderResult {
  const { providerId, providerName, ok, configured, usage, error } = input;
  return {
    providerId,
    providerName,
    ok,
    configured,
    usage: usage ?? null,
    ...(error ? { error } : {}),
    fetchedAt: Date.now(),
  };
}

export function formatMoney(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value.toFixed(2);
}
