import { z } from "zod";

const InstalledSkillSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  path: z.string(),
});

const ScannedSkillSchema = z.object({
  skillDir: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

const SkillsCatalogErrorSchema = z.object({
  kind: z.enum([
    "invalidSource",
    "gitUnavailable",
    "authRequired",
    "networkError",
    "conflicts",
    "unknown",
  ]),
  message: z.string(),
  conflicts: z.array(z.string()).optional(),
});

const SkippedSkillSchema = z.object({ skillName: z.string(), reason: z.string() });

// --- Requests ---

export const SkillsListRequestSchema = z.object({
  type: z.literal("skills/list"),
  requestId: z.string(),
});

export const SkillsScanRequestSchema = z.object({
  type: z.literal("skills/scan"),
  requestId: z.string(),
  source: z.string(),
  subpath: z.string().optional(),
});

export const SkillsInstallRequestSchema = z.object({
  type: z.literal("skills/install"),
  requestId: z.string(),
  source: z.string(),
  subpath: z.string().optional(),
  skillDirs: z.array(z.string()),
  overwrite: z.boolean().optional(),
});

// --- Responses ---

export const SkillsListResponseSchema = z.object({
  type: z.literal("skills/list/response"),
  payload: z.object({
    requestId: z.string(),
    skills: z.array(InstalledSkillSchema),
    error: z.string().nullable(),
  }),
});

export const SkillsScanResponseSchema = z.object({
  type: z.literal("skills/scan/response"),
  payload: z.object({
    requestId: z.string(),
    skills: z.array(ScannedSkillSchema),
    error: SkillsCatalogErrorSchema.nullable(),
  }),
});

export const SkillsInstallResponseSchema = z.object({
  type: z.literal("skills/install/response"),
  payload: z.object({
    requestId: z.string(),
    installed: z.array(z.string()),
    skipped: z.array(SkippedSkillSchema),
    error: SkillsCatalogErrorSchema.nullable(),
  }),
});
