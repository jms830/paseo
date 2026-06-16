// Shared git-identity types. Single source of truth consumed by the server
// (git-identity/service) and the app (git-identity-section).

export interface RepoGitIdentity {
  name: string | null;
  email: string | null;
  /** True when the values come from the repo-local config rather than global/inherited. */
  local: boolean;
}
