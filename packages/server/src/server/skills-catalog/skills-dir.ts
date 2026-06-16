// Resolves the OMP/pi user skills directory and lists installed skills.
// pi looks for skills at ~/.pi/agent/skills (commonly symlinked to ~/.agents/skills).
import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseSkillFrontmatter } from "./frontmatter.js";

import type { InstalledSkill } from "@getpaseo/protocol/skills-catalog/types";

export type { InstalledSkill };

export function getUserSkillsDir(): string {
  return join(homedir(), ".pi", "agent", "skills");
}

export async function listInstalledSkills(): Promise<InstalledSkill[]> {
  const skillsDir = getUserSkillsDir();
  if (!existsSync(skillsDir)) {
    return [];
  }
  const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
  const skills: InstalledSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    const skillPath = join(skillsDir, entry.name);
    const skillMdPath = join(skillPath, "SKILL.md");
    if (!existsSync(skillMdPath)) {
      continue;
    }
    let description: string | null = null;
    let name = entry.name;
    try {
      const frontmatter = parseSkillFrontmatter(readFileSync(skillMdPath, "utf8"));
      description = frontmatter.description;
      if (frontmatter.name) {
        name = frontmatter.name;
      }
    } catch {
      // Keep directory-derived name when frontmatter is unreadable.
    }
    skills.push({ name, description, path: skillPath });
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name));
}
