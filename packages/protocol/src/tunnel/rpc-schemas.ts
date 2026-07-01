import { z } from "zod";

const TunnelStatusSchema = z.object({
  state: z.enum(["stopped", "starting", "running", "error"]),
  url: z.string().nullable(),
  error: z.string().nullable(),
  port: z.number().nullable(),
});

export const TunnelStatusRequestSchema = z.object({
  type: z.literal("tunnel/status"),
  requestId: z.string(),
});

export const TunnelStartRequestSchema = z.object({
  type: z.literal("tunnel/start"),
  requestId: z.string(),
});

export const TunnelStopRequestSchema = z.object({
  type: z.literal("tunnel/stop"),
  requestId: z.string(),
});

export const TunnelStatusResponseSchema = z.object({
  type: z.literal("tunnel/status/response"),
  payload: z.object({
    requestId: z.string(),
    status: TunnelStatusSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const TunnelStartResponseSchema = z.object({
  type: z.literal("tunnel/start/response"),
  payload: z.object({
    requestId: z.string(),
    status: TunnelStatusSchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const TunnelStopResponseSchema = z.object({
  type: z.literal("tunnel/stop/response"),
  payload: z.object({
    requestId: z.string(),
    status: TunnelStatusSchema.nullable(),
    error: z.string().nullable(),
  }),
});
