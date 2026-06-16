import { useQuery } from "@tanstack/react-query";
import type { ProviderResult } from "@getpaseo/protocol/quota/types";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";

export type QuotaProviderResult = ProviderResult;

export function quotaQueryKey(serverId: string | null): (string | null)[] {
  return ["quota", serverId];
}

interface UseQuotaResult {
  results: ProviderResult[];
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches configured provider quotas for a host: lists configured providers, then fetches each in
 * parallel. Server-backed via the daemon RPC (quota/list + quota/fetch).
 */
export function useQuota(serverId: string | null, enabled = true): UseQuotaResult {
  const client = useHostRuntimeClient(serverId ?? "");
  const isConnected = useHostRuntimeIsConnected(serverId ?? "");

  const query = useQuery<ProviderResult[]>({
    queryKey: quotaQueryKey(serverId),
    enabled: enabled && Boolean(serverId) && isConnected && Boolean(client),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client) {
        return [];
      }
      const listPayload = await client.quotaList();
      if (listPayload.error) {
        throw new Error(listPayload.error);
      }
      const settled = await Promise.allSettled(
        listPayload.providerIds.map((providerId) => client.quotaFetch(providerId)),
      );
      const results: ProviderResult[] = [];
      for (const outcome of settled) {
        if (outcome.status === "fulfilled" && outcome.value.result) {
          results.push(outcome.value.result);
        }
      }
      return results;
    },
  });

  return {
    results: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: () => {
      void query.refetch();
    },
  };
}
