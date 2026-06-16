import { fetchQuotaForProvider, listConfiguredQuotaProviders } from "./providers/index.js";
import type { ProviderResult } from "@getpaseo/protocol/quota/types";

/**
 * Thin wrapper over the quota provider registry, mirroring the ScheduleService shape so it can be
 * injected into Session the same way. Stateless; the registry reads credentials per call.
 */
export class QuotaService {
  listConfigured(): string[] {
    return listConfiguredQuotaProviders();
  }

  fetch(providerId: string): Promise<ProviderResult> {
    return fetchQuotaForProvider(providerId);
  }
}
