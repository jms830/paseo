import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import type { InstalledSkill } from "@getpaseo/protocol/skills-catalog/types";
import type { ScannedSkill, SkillsCatalogError } from "@getpaseo/protocol/skills-catalog/types";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";

export type { InstalledSkill, ScannedSkill, SkillsCatalogError };

export interface SkillsScanOutcome {
  skills: ScannedSkill[];
  error: SkillsCatalogError | null;
}

export interface SkillsInstallOutcome {
  installed: string[];
  skipped: { skillName: string; reason: string }[];
  error: SkillsCatalogError | null;
}

export function skillsQueryKey(serverId: string | null): (string | null)[] {
  return ["skills", serverId];
}

interface UseSkillsResult {
  installed: InstalledSkill[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  scan: (source: string, subpath?: string) => Promise<SkillsScanOutcome>;
  install: (input: {
    source: string;
    subpath?: string;
    skillDirs: string[];
    overwrite?: boolean;
  }) => Promise<SkillsInstallOutcome>;
}

export function useSkills(serverId: string | null): UseSkillsResult {
  const client = useHostRuntimeClient(serverId ?? "");
  const isConnected = useHostRuntimeIsConnected(serverId ?? "");

  const query = useQuery<InstalledSkill[]>({
    queryKey: skillsQueryKey(serverId),
    enabled: Boolean(serverId) && isConnected && Boolean(client),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) {
        return [];
      }
      const payload = await client.skillsList();
      if (payload.error) {
        throw new Error(payload.error);
      }
      return payload.skills;
    },
  });

  const scan = useCallback<UseSkillsResult["scan"]>(
    async (source, subpath) => {
      if (!client) {
        return { skills: [], error: { kind: "unknown", message: "Not connected" } };
      }
      const payload = await client.skillsScan({ source, subpath });
      return { skills: payload.skills, error: payload.error };
    },
    [client],
  );

  const install = useCallback<UseSkillsResult["install"]>(
    async (input) => {
      if (!client) {
        return { installed: [], skipped: [], error: { kind: "unknown", message: "Not connected" } };
      }
      const payload = await client.skillsInstall(input);
      if (!payload.error) {
        void query.refetch();
      }
      return { installed: payload.installed, skipped: payload.skipped, error: payload.error };
    },
    [client, query],
  );

  return {
    installed: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: () => {
      void query.refetch();
    },
    scan,
    install,
  };
}
