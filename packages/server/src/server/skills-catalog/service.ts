import { getUserSkillsDir, listInstalledSkills, type InstalledSkill } from "./skills-dir.js";
import {
  installSkillsFromRepository,
  scanRepository,
  type ScannedSkill,
  type SkillsCatalogError,
} from "./repo.js";

export type ScanResult =
  | { ok: true; skills: ScannedSkill[] }
  | { ok: false; error: SkillsCatalogError };

export type InstallResult =
  | { ok: true; installed: string[]; skipped: { skillName: string; reason: string }[] }
  | { ok: false; error: SkillsCatalogError };

/** Stateless wrapper over the skills-catalog operations, injected into Session like other services. */
export class SkillsCatalogService {
  listInstalled(): Promise<InstalledSkill[]> {
    return listInstalledSkills();
  }

  scan(source: string, subpath?: string): Promise<ScanResult> {
    return scanRepository(source, subpath);
  }

  install(input: {
    source: string;
    subpath?: string;
    skillDirs: string[];
    overwrite?: boolean;
  }): Promise<InstallResult> {
    return installSkillsFromRepository({
      source: input.source,
      subpath: input.subpath,
      skillDirs: input.skillDirs,
      userSkillsDir: getUserSkillsDir(),
      overwrite: input.overwrite,
    });
  }
}
