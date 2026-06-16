// Ported from openchamber/openchamber (MIT): packages/web/server/lib/quota/providers/index.js
import { buildResult } from "../formatters.js";
import type { ProviderResult } from "@getpaseo/protocol/quota/types";
import { claudeProvider } from "./claude.js";
import { codexProvider } from "./codex.js";
import { copilotProvider } from "./copilot.js";
import { openrouterProvider } from "./openrouter.js";
import type { QuotaProvider } from "./types.js";

const REGISTRY: Record<string, QuotaProvider> = {
  claude: claudeProvider,
  codex: codexProvider,
  "github-copilot": copilotProvider,
  openrouter: openrouterProvider,
};

export function listConfiguredQuotaProviders(): string[] {
  const configured: string[] = [];
  for (const [id, provider] of Object.entries(REGISTRY)) {
    try {
      if (provider.isConfigured()) {
        configured.push(id);
      }
    } catch {
      // Ignore provider-specific config errors in the list API.
    }
  }
  return configured;
}

export async function fetchQuotaForProvider(providerId: string): Promise<ProviderResult> {
  const provider = REGISTRY[providerId];
  if (!provider) {
    return buildResult({
      providerId,
      providerName: providerId,
      ok: false,
      configured: false,
      error: "Unsupported provider",
    });
  }
  try {
    return await provider.fetchQuota();
  } catch (error) {
    return buildResult({
      providerId: provider.providerId,
      providerName: provider.providerName,
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : "Request failed",
    });
  }
}
