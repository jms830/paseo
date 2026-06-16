// Ported from openchamber/openchamber (MIT): packages/ui/src/types/quota.ts
// Quota data model + Zod schemas for the WebSocket RPC surface.
import { z } from "zod";

export const QUOTA_PROVIDER_IDS = ["claude", "codex", "github-copilot", "openrouter"] as const;

export type QuotaProviderId = (typeof QUOTA_PROVIDER_IDS)[number];

export const UsageWindowSchema = z.object({
  usedPercent: z.number().nullable(),
  remainingPercent: z.number().nullable(),
  windowSeconds: z.number().nullable(),
  resetAfterSeconds: z.number().nullable(),
  resetAt: z.number().nullable(),
  resetAtFormatted: z.string().nullable(),
  resetAfterFormatted: z.string().nullable(),
  valueLabel: z.string().nullable().optional(),
});
export type UsageWindow = z.infer<typeof UsageWindowSchema>;

export const ProviderUsageSchema = z.object({
  windows: z.record(z.string(), UsageWindowSchema),
  models: z
    .record(z.string(), z.object({ windows: z.record(z.string(), UsageWindowSchema) }))
    .optional(),
});
export type ProviderUsage = z.infer<typeof ProviderUsageSchema>;

export const ProviderResultSchema = z.object({
  providerId: z.string(),
  providerName: z.string(),
  ok: z.boolean(),
  configured: z.boolean(),
  error: z.string().optional(),
  usage: ProviderUsageSchema.nullable(),
  fetchedAt: z.number(),
});
export type ProviderResult = z.infer<typeof ProviderResultSchema>;
