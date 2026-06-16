// Ported concept from openchamber/openchamber (MIT): packages/ui/src/stores/useGitIdentitiesStore.ts
// Named git identity profiles (name + email) the user can apply to a repository. Client-only,
// AsyncStorage-persisted (matches sidebar/workspace-folders convention). Applying a profile writes
// the repo-local git config via the daemon git-identity RPC.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface GitIdentityProfile {
  id: string;
  label: string;
  name: string;
  email: string;
}

interface GitIdentitiesState {
  profiles: GitIdentityProfile[];
}

interface GitIdentitiesActions {
  addProfile: (input: { label: string; name: string; email: string }) => GitIdentityProfile;
  updateProfile: (id: string, input: { label: string; name: string; email: string }) => void;
  removeProfile: (id: string) => void;
}

type GitIdentitiesStore = GitIdentitiesState & GitIdentitiesActions;

function createProfileId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `identity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeProfiles(value: unknown): GitIdentityProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const profiles: GitIdentityProfile[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const email = typeof candidate.email === "string" ? candidate.email.trim() : "";
    if (!id || !name || !email) {
      continue;
    }
    const label =
      typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : name;
    profiles.push({ id, label, name, email });
  }
  return profiles;
}

export const useGitIdentitiesStore = create<GitIdentitiesStore>()(
  persist(
    (set) => ({
      profiles: [],

      addProfile: ({ label, name, email }) => {
        const profile: GitIdentityProfile = {
          id: createProfileId(),
          label: label.trim() || name.trim(),
          name: name.trim(),
          email: email.trim(),
        };
        set((state) => ({ profiles: state.profiles.concat(profile) }));
        return profile;
      },

      updateProfile: (id, { label, name, email }) => {
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === id
              ? Object.assign({}, profile, {
                  label: label.trim() || name.trim(),
                  name: name.trim(),
                  email: email.trim(),
                })
              : profile,
          ),
        }));
      },

      removeProfile: (id) => {
        set((state) => ({ profiles: state.profiles.filter((profile) => profile.id !== id) }));
      },
    }),
    {
      name: "git-identities",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ profiles: state.profiles }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { profiles?: unknown } | undefined;
        return {
          ...currentState,
          profiles: sanitizeProfiles(persisted?.profiles),
        };
      },
    },
  ),
);
