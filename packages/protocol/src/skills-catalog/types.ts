// Shared skills-catalog types. Single source of truth consumed by the server
// (skills-dir/repo) and the app (use-skills). Kept in the protocol package so the
// app does not deep-import server internals.

export interface InstalledSkill {
  name: string;
  description: string | null;
  path: string;
}

export interface ScannedSkill {
  skillDir: string;
  name: string;
  description: string | null;
}

export type SkillsCatalogErrorKind =
  | "invalidSource"
  | "gitUnavailable"
  | "authRequired"
  | "networkError"
  | "conflicts"
  | "unknown";

export interface SkillsCatalogError {
  kind: SkillsCatalogErrorKind;
  message: string;
  conflicts?: string[];
}
