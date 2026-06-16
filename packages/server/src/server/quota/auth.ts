// Ported from openchamber/openchamber (MIT): packages/web/server/lib/{opencode/auth.js,quota/utils/auth.js}
// Adapted for Paseo/OMP: reads the pi agent auth file (~/.pi/agent/auth.json) first, then falls back
// to opencode-family locations so credentials provisioned by either CLI resolve.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type AuthEntry = Record<string, unknown> & {
  type?: string;
  key?: string;
  token?: string;
  access?: string;
  refresh?: string;
};

export type AuthFile = Record<string, AuthEntry | string>;

// Search order: pi agent auth, then opencode data/config dirs.
const AUTH_FILE_CANDIDATES = [
  join(homedir(), ".pi", "agent", "auth.json"),
  join(homedir(), ".local", "share", "opencode", "auth.json"),
  join(homedir(), ".config", "opencode", "auth.json"),
];

export function readAuthFile(): AuthFile {
  for (const candidate of AUTH_FILE_CANDIDATES) {
    if (!existsSync(candidate)) {
      continue;
    }
    try {
      const trimmed = readFileSync(candidate, "utf8").trim();
      if (!trimmed) {
        continue;
      }
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as AuthFile;
      }
    } catch {
      // Try the next candidate on parse/read failure.
    }
  }
  return {};
}

export function getAuthEntry(auth: AuthFile, aliases: string[]): AuthEntry | string | null {
  for (const alias of aliases) {
    const entry = auth[alias];
    if (entry) {
      return entry;
    }
  }
  return null;
}

export function normalizeAuthEntry(entry: AuthEntry | string | null): AuthEntry | null {
  if (!entry) {
    return null;
  }
  if (typeof entry === "string") {
    return { token: entry };
  }
  if (typeof entry === "object") {
    return entry;
  }
  return null;
}
