// Ported/adapted from openchamber/openchamber (MIT): packages/web/server/lib/skills-catalog/{git.js,install.js}
// Scoped to OMP/pi user skills (no project/targetSource matrix). Git runs via Paseo's execCommand.
import { existsSync } from "node:fs";
import {
  copyFile,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { execCommand } from "../../utils/spawn.js";
import { parseSkillFrontmatter } from "./frontmatter.js";
import { parseSkillRepoSource } from "./source.js";

const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

import type {
  ScannedSkill,
  SkillsCatalogErrorKind,
  SkillsCatalogError,
} from "@getpaseo/protocol/skills-catalog/types";

export type { ScannedSkill, SkillsCatalogErrorKind, SkillsCatalogError };

interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

async function runGit(args: string[], timeoutMs: number): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execCommand("git", args, { timeout: timeoutMs });
    return { ok: true, stdout, stderr };
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, stdout: "", stderr: stderr || message };
  }
}

async function assertGitAvailable(): Promise<boolean> {
  const result = await runGit(["--version"], 5_000);
  return result.ok;
}

function looksLikeAuthError(message: string): boolean {
  return /authentication|could not read username|permission denied|access denied|fatal: repository .* not found/i.test(
    message,
  );
}

function validateSkillName(skillName: string): boolean {
  if (skillName.length < 1 || skillName.length > 64) {
    return false;
  }
  return SKILL_NAME_PATTERN.test(skillName);
}

async function safeRm(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

async function copyDirectoryNoSymlinks(srcDir: string, dstDir: string): Promise<void> {
  const srcReal = await realpath(srcDir);
  await mkdir(dstDir, { recursive: true });
  const walk = async (currentSrc: string, currentDst: string): Promise<void> => {
    const entries = await readdir(currentSrc, { withFileTypes: true });
    for (const entry of entries) {
      const nextSrc = join(currentSrc, entry.name);
      const nextDst = join(currentDst, entry.name);
      const stat = await lstat(nextSrc);
      if (stat.isSymbolicLink()) {
        throw new Error("Symlinks are not supported in skills");
      }
      const nextRealParent = await realpath(dirname(nextSrc));
      if (!nextRealParent.startsWith(srcReal)) {
        throw new Error("Invalid source path traversal detected");
      }
      if (stat.isDirectory()) {
        await mkdir(nextDst, { recursive: true });
        await walk(nextSrc, nextDst);
      } else if (stat.isFile()) {
        await mkdir(dirname(nextDst), { recursive: true });
        await copyFile(nextSrc, nextDst);
        await chmod(nextDst, stat.mode & 0o777).catch(() => undefined);
      }
    }
  };
  await walk(srcDir, dstDir);
}

async function cloneNoCheckout(cloneUrl: string, tempDir: string): Promise<GitResult> {
  const preferred = await runGit(
    ["clone", "--depth", "1", "--filter=blob:none", "--no-checkout", cloneUrl, tempDir],
    90_000,
  );
  if (preferred.ok) {
    return preferred;
  }
  return runGit(["clone", "--depth", "1", "--no-checkout", cloneUrl, tempDir], 90_000);
}

/** Lists installable skills (directories containing SKILL.md) in a repository. */
export async function scanRepository(
  source: string,
  subpath?: string,
): Promise<{ ok: true; skills: ScannedSkill[] } | { ok: false; error: SkillsCatalogError }> {
  if (!(await assertGitAvailable())) {
    return { ok: false, error: { kind: "gitUnavailable", message: "git is not available" } };
  }
  const parsed = parseSkillRepoSource(source, { subpath });
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  const tempBase = await mkdtemp(join(tmpdir(), "paseo-skills-scan-"));
  try {
    const cloned = await cloneNoCheckout(parsed.cloneUrlHttps, tempBase);
    if (!cloned.ok) {
      const message = cloned.stderr.trim() || "Failed to clone repository";
      const kind: SkillsCatalogErrorKind = looksLikeAuthError(message)
        ? "authRequired"
        : "networkError";
      return { ok: false, error: { kind, message } };
    }
    const tree = await runGit(["-C", tempBase, "ls-tree", "-r", "HEAD", "--name-only"], 30_000);
    if (!tree.ok) {
      return {
        ok: false,
        error: { kind: "unknown", message: tree.stderr || "Failed to read repository tree" },
      };
    }
    const prefix = parsed.effectiveSubpath ? `${parsed.effectiveSubpath.replace(/\/$/, "")}/` : "";
    const skillDirs: string[] = [];
    for (const line of tree.stdout.split("\n")) {
      const path = line.trim();
      if (!path.endsWith("SKILL.md")) {
        continue;
      }
      if (prefix && !path.startsWith(prefix)) {
        continue;
      }
      const skillDir = path.slice(0, -"/SKILL.md".length);
      if (skillDir) {
        skillDirs.push(skillDir);
      }
    }
    if (skillDirs.length === 0) {
      return { ok: true, skills: [] };
    }
    // Sparse-checkout the SKILL.md files to read names/descriptions.
    await runGit(["-C", tempBase, "sparse-checkout", "init", "--no-cone"], 15_000);
    await runGit(
      ["-C", tempBase, "sparse-checkout", "set", ...skillDirs.map((dir) => `${dir}/SKILL.md`)],
      30_000,
    );
    await runGit(["-C", tempBase, "checkout", "--force", "HEAD"], 60_000);
    const skills: ScannedSkill[] = [];
    for (const skillDir of skillDirs) {
      const name = basename(skillDir);
      let description: string | null = null;
      const skillMdPath = join(tempBase, ...skillDir.split("/"), "SKILL.md");
      if (existsSync(skillMdPath)) {
        const frontmatter = parseSkillFrontmatter(
          await readFile(skillMdPath, "utf8").catch(() => ""),
        );
        description = frontmatter.description;
      }
      skills.push({ skillDir, name, description });
    }
    return { ok: true, skills };
  } finally {
    await safeRm(tempBase);
  }
}

interface InstallPlan {
  skillDir: string;
  skillName: string;
  installable: boolean;
}

async function copyPlansToSkillsDir(
  plans: InstallPlan[],
  tempBase: string,
  userSkillsDir: string,
): Promise<{ installed: string[]; skipped: { skillName: string; reason: string }[] }> {
  const installed: string[] = [];
  const skipped: { skillName: string; reason: string }[] = [];
  for (const plan of plans) {
    if (!plan.installable) {
      skipped.push({ skillName: plan.skillName, reason: "Invalid skill name" });
      continue;
    }
    const srcDir = join(tempBase, ...plan.skillDir.split("/"));
    if (!existsSync(join(srcDir, "SKILL.md"))) {
      skipped.push({ skillName: plan.skillName, reason: "SKILL.md not found" });
      continue;
    }
    const targetDir = join(userSkillsDir, plan.skillName);
    if (existsSync(targetDir)) {
      await safeRm(targetDir);
    }
    await mkdir(dirname(targetDir), { recursive: true });
    try {
      await copyDirectoryNoSymlinks(srcDir, targetDir);
      installed.push(plan.skillName);
    } catch (error) {
      await safeRm(targetDir);
      skipped.push({
        skillName: plan.skillName,
        reason: error instanceof Error ? error.message : "Failed to copy skill files",
      });
    }
  }
  return { installed, skipped };
}

/** Installs the selected skill directories from a repository into the user (pi) skills dir. */
export async function installSkillsFromRepository(input: {
  source: string;
  subpath?: string;
  skillDirs: string[];
  userSkillsDir: string;
  overwrite?: boolean;
}): Promise<
  | { ok: true; installed: string[]; skipped: { skillName: string; reason: string }[] }
  | { ok: false; error: SkillsCatalogError }
> {
  if (!(await assertGitAvailable())) {
    return { ok: false, error: { kind: "gitUnavailable", message: "git is not available" } };
  }
  const parsed = parseSkillRepoSource(input.source, { subpath: input.subpath });
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  const requestedDirs = input.skillDirs.map((dir) => dir.trim()).filter(Boolean);
  if (requestedDirs.length === 0) {
    return {
      ok: false,
      error: { kind: "invalidSource", message: "No skills selected for installation" },
    };
  }
  const plans = requestedDirs.map((skillDir) => ({
    skillDir,
    skillName: basename(skillDir),
    installable: validateSkillName(basename(skillDir)),
  }));

  const conflicts: string[] = [];
  if (!input.overwrite) {
    for (const plan of plans) {
      if (plan.installable && existsSync(join(input.userSkillsDir, plan.skillName))) {
        conflicts.push(plan.skillName);
      }
    }
    if (conflicts.length > 0) {
      return {
        ok: false,
        error: { kind: "conflicts", message: "Some skills already exist", conflicts },
      };
    }
  }

  const tempBase = await mkdtemp(join(tmpdir(), "paseo-skills-install-"));
  try {
    const cloned = await cloneNoCheckout(parsed.cloneUrlHttps, tempBase);
    if (!cloned.ok) {
      const message = cloned.stderr.trim() || "Failed to clone repository";
      const kind: SkillsCatalogErrorKind = looksLikeAuthError(message)
        ? "authRequired"
        : "networkError";
      return { ok: false, error: { kind, message } };
    }
    await runGit(["-C", tempBase, "sparse-checkout", "init", "--cone"], 15_000);
    const setResult = await runGit(
      ["-C", tempBase, "sparse-checkout", "set", ...requestedDirs],
      30_000,
    );
    if (!setResult.ok) {
      return {
        ok: false,
        error: {
          kind: "unknown",
          message: setResult.stderr || "Failed to configure sparse checkout",
        },
      };
    }
    const checkout = await runGit(["-C", tempBase, "checkout", "--force", "HEAD"], 60_000);
    if (!checkout.ok) {
      return {
        ok: false,
        error: { kind: "unknown", message: checkout.stderr || "Failed to checkout repository" },
      };
    }

    const outcome = await copyPlansToSkillsDir(plans, tempBase, input.userSkillsDir);
    return { ok: true, installed: outcome.installed, skipped: outcome.skipped };
  } finally {
    await safeRm(tempBase);
  }
}
