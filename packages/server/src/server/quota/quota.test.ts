import { describe, expect, it } from "vitest";
import {
  buildResult,
  calculateResetAfterSeconds,
  formatMoney,
  toUsageWindow,
} from "./formatters.js";
import { toNumber, toTimestamp } from "./transformers.js";
import { fetchQuotaForProvider } from "./providers/index.js";

describe("quota transformers", () => {
  it("coerces numbers from strings and rejects junk", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber("3.5")).toBe(3.5);
    expect(toNumber("nope")).toBeNull();
    expect(toNumber(null)).toBeNull();
  });

  it("normalizes timestamps (seconds -> ms, ISO -> ms)", () => {
    expect(toTimestamp(1_000)).toBe(1_000_000);
    expect(toTimestamp(2_000_000_000_000)).toBe(2_000_000_000_000);
    expect(toTimestamp("2025-01-01T00:00:00Z")).toBe(Date.parse("2025-01-01T00:00:00Z"));
    expect(toTimestamp(null)).toBeNull();
  });
});

describe("quota formatters", () => {
  it("formats money to two decimals", () => {
    expect(formatMoney(3.5)).toBe("3.50");
    expect(formatMoney("x")).toBeNull();
  });

  it("derives remaining percent from used percent", () => {
    const window = toUsageWindow({ usedPercent: 30, windowSeconds: 3600, resetAt: null });
    expect(window.remainingPercent).toBe(70);
    expect(window.windowSeconds).toBe(3600);
  });

  it("leaves remaining percent null when usedPercent is null", () => {
    const window = toUsageWindow({ usedPercent: null, windowSeconds: null, resetAt: null });
    expect(window.remainingPercent).toBeNull();
  });

  it("clamps negative reset deltas to zero", () => {
    expect(calculateResetAfterSeconds(Date.now() - 10_000)).toBe(0);
    expect(calculateResetAfterSeconds(null)).toBeNull();
  });

  it("builds a result with fetchedAt and optional error", () => {
    const ok = buildResult({ providerId: "x", providerName: "X", ok: true, configured: true });
    expect(ok.usage).toBeNull();
    expect(ok.fetchedAt).toBeGreaterThan(0);
    expect("error" in ok).toBe(false);

    const failed = buildResult({
      providerId: "x",
      providerName: "X",
      ok: false,
      configured: false,
      error: "boom",
    });
    expect(failed.error).toBe("boom");
  });
});

describe("quota registry", () => {
  it("returns an unsupported result for unknown providers", async () => {
    const result = await fetchQuotaForProvider("does-not-exist");
    expect(result.ok).toBe(false);
    expect(result.configured).toBe(false);
    expect(result.error).toBe("Unsupported provider");
  });
});
