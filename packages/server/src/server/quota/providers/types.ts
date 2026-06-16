import type { ProviderResult } from "@getpaseo/protocol/quota/types";

export interface QuotaProvider {
  providerId: string;
  providerName: string;
  isConfigured: () => boolean;
  fetchQuota: () => Promise<ProviderResult>;
}
