import { z } from "zod";

const RepoGitIdentitySchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  local: z.boolean(),
});

export const GitIdentityGetRequestSchema = z.object({
  type: z.literal("git-identity/get"),
  requestId: z.string(),
  cwd: z.string(),
});

export const GitIdentitySetRequestSchema = z.object({
  type: z.literal("git-identity/set"),
  requestId: z.string(),
  cwd: z.string(),
  name: z.string(),
  email: z.string(),
});

export const GitIdentityGetResponseSchema = z.object({
  type: z.literal("git-identity/get/response"),
  payload: z.object({
    requestId: z.string(),
    identity: RepoGitIdentitySchema.nullable(),
    error: z.string().nullable(),
  }),
});

export const GitIdentitySetResponseSchema = z.object({
  type: z.literal("git-identity/set/response"),
  payload: z.object({
    requestId: z.string(),
    identity: RepoGitIdentitySchema.nullable(),
    error: z.string().nullable(),
  }),
});
