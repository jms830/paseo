import { z } from "zod";
import { ProviderResultSchema } from "./types.js";

export const QuotaListRequestSchema = z.object({
  type: z.literal("quota/list"),
  requestId: z.string(),
});

export const QuotaFetchRequestSchema = z.object({
  type: z.literal("quota/fetch"),
  requestId: z.string(),
  providerId: z.string(),
});

export const QuotaListResponseSchema = z.object({
  type: z.literal("quota/list/response"),
  payload: z.object({
    requestId: z.string(),
    providerIds: z.array(z.string()),
    error: z.string().nullable(),
  }),
});

export const QuotaFetchResponseSchema = z.object({
  type: z.literal("quota/fetch/response"),
  payload: z.object({
    requestId: z.string(),
    result: ProviderResultSchema.nullable(),
    error: z.string().nullable(),
  }),
});
