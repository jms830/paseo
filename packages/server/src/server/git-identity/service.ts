// Per-repository git identity (user.name / user.email). Ported concept from
// openchamber/openchamber (MIT): packages/web/server/lib/git/identity-storage.js.
// Paseo stores named profiles client-side; the server only reads/writes the repo-local git config.
import { execCommand } from "../../utils/spawn.js";

import type { RepoGitIdentity } from "@getpaseo/protocol/git-identity/types";

export type { RepoGitIdentity };

async function readGitConfig(
  cwd: string,
  key: string,
  scope: "local" | null,
): Promise<string | null> {
  const args = scope === "local" ? ["config", "--local", key] : ["config", key];
  try {
    const { stdout } = await execCommand("git", args, { cwd, timeout: 10_000 });
    const value = stdout.trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export class GitIdentityService {
  async get(cwd: string): Promise<RepoGitIdentity> {
    const [localName, localEmail] = await Promise.all([
      readGitConfig(cwd, "user.name", "local"),
      readGitConfig(cwd, "user.email", "local"),
    ]);
    if (localName || localEmail) {
      return { name: localName, email: localEmail, local: true };
    }
    const [name, email] = await Promise.all([
      readGitConfig(cwd, "user.name", null),
      readGitConfig(cwd, "user.email", null),
    ]);
    return { name, email, local: false };
  }

  async set(cwd: string, name: string, email: string): Promise<void> {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) {
      throw new Error("Both name and email are required");
    }
    await execCommand("git", ["config", "--local", "user.name", trimmedName], {
      cwd,
      timeout: 10_000,
    });
    await execCommand("git", ["config", "--local", "user.email", trimmedEmail], {
      cwd,
      timeout: 10_000,
    });
  }
}
