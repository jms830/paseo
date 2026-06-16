// Ported from openchamber/openchamber (MIT): packages/web/server/lib/skills-catalog/source.js
const GITHUB_HOST = "github.com";

export interface ParsedSkillRepoSource {
  host: string;
  owner: string;
  repo: string;
  cloneUrlSsh: string;
  cloneUrlHttps: string;
  effectiveSubpath: string | null;
  normalizedRepo: string;
}

export type ParseSkillRepoResult =
  | ({ ok: true } & ParsedSkillRepoSource)
  | { ok: false; error: { kind: "invalidSource"; message: string } };

function normalizeGitOwnerRepo(
  owner: string,
  repo: string,
): { owner: string; repo: string } | null {
  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.trim().replace(/\.git$/i, "");
  if (!normalizedOwner || !normalizedRepo) {
    return null;
  }
  return { owner: normalizedOwner, repo: normalizedRepo };
}

function splitGitSegments(rawPath: string): { owner: string; repoName: string } {
  const segments = rawPath.split("/").filter(Boolean);
  const repoName = segments.length > 0 ? segments[segments.length - 1].replace(/\.git$/i, "") : "";
  const owner = segments.length > 1 ? segments.slice(0, -1).join("/") : "";
  return { owner, repoName };
}

function parseHttpsSource(raw: string, explicitSubpath: string | null): ParseSkillRepoResult {
  const host = raw.split("/")[2] ?? null;
  const { owner, repoName } = splitGitSegments(raw.split("/").slice(3).join("/"));
  const parsed = host ? normalizeGitOwnerRepo(owner, repoName) : null;
  if (!host || !parsed) {
    return { ok: false, error: { kind: "invalidSource", message: "Invalid https repository URL" } };
  }
  return buildResult(host, parsed, explicitSubpath);
}

function parseSshSource(raw: string, explicitSubpath: string | null): ParseSkillRepoResult {
  const afterAt = raw.split("@")[1] ?? "";
  const host = afterAt.split(":")[0] ?? null;
  const { owner, repoName } = splitGitSegments(afterAt.split(":")[1] ?? "");
  const parsed = host ? normalizeGitOwnerRepo(owner, repoName) : null;
  if (!host || !parsed) {
    return { ok: false, error: { kind: "invalidSource", message: "Invalid ssh repository URL" } };
  }
  return buildResult(host, parsed, explicitSubpath);
}

function parseShorthandSource(raw: string, explicitSubpath: string | null): ParseSkillRepoResult {
  const shorthandMatch = raw.match(/^([^/\s]+)\/([^/\s]+)(?:\/(.+))?$/);
  if (!shorthandMatch) {
    return {
      ok: false,
      error: { kind: "invalidSource", message: "Unsupported repository source format" },
    };
  }
  const parsed = normalizeGitOwnerRepo(shorthandMatch[1], shorthandMatch[2]);
  if (!parsed) {
    return { ok: false, error: { kind: "invalidSource", message: "Invalid repository source" } };
  }
  const shorthandSubpath = shorthandMatch[3]?.trim() ? shorthandMatch[3].trim() : null;
  return buildResult(GITHUB_HOST, parsed, explicitSubpath || shorthandSubpath);
}

/**
 * Parses a skill repository source: an `owner/repo[/subpath]` shorthand, an `https://host/owner/repo`
 * URL, or an `git@host:owner/repo` SSH URL. Returns clone URLs and an optional subpath.
 */
export function parseSkillRepoSource(
  input: string,
  options: { subpath?: string } = {},
): ParseSkillRepoResult {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) {
    return {
      ok: false,
      error: { kind: "invalidSource", message: "Repository source is required" },
    };
  }
  const explicitSubpath = options.subpath?.trim() ? options.subpath.trim() : null;
  if (raw.startsWith("https://")) {
    return parseHttpsSource(raw, explicitSubpath);
  }
  if (raw.startsWith("git@")) {
    return parseSshSource(raw, explicitSubpath);
  }
  return parseShorthandSource(raw, explicitSubpath);
}

function buildResult(
  host: string,
  parsed: { owner: string; repo: string },
  effectiveSubpath: string | null,
): ParseSkillRepoResult {
  return {
    ok: true,
    host,
    owner: parsed.owner,
    repo: parsed.repo,
    cloneUrlSsh: `git@${host}:${parsed.owner}/${parsed.repo}.git`,
    cloneUrlHttps: `https://${host}/${parsed.owner}/${parsed.repo}.git`,
    effectiveSubpath,
    normalizedRepo: `${parsed.owner}/${parsed.repo}`,
  };
}
