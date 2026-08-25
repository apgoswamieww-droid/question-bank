/**
 * Provider Factory
 * ================
 * Creates and configures vision providers based on environment.
 *
 * Provider selection:
 * - KAP_ANALYZER_PROVIDER=openai → OpenAI Vision Provider (OmniRoute-compatible)
 * - KAP_ANALYZER_PROVIDER=mock → Mock Provider (development only)
 * - Default: openai
 *
 * API Key priority:
 * - KAP_VISION_API_KEY (preferred)
 * - OPENAI_API_KEY (backwards compat fallback)
 *
 * SAFETY:
 * - If API key is missing and provider=openai, FAIL clearly
 * - Never silently fall back to mock in production
 * - Mock provider is ONLY for explicit development/test use
 */

import type { VisionProvider } from "./types";
import { MockProvider } from "./mock-provider";
import { OpenAIVisionProvider } from "./openai-vision-provider";

/**
 * Provider type configuration.
 */
export type ProviderType = "openai" | "mock";

/**
 * Provider factory configuration.
 */
export interface ProviderFactoryConfig {
  /** Provider type - defaults to KAP_ANALYZER_PROVIDER env or "openai" */
  providerType?: ProviderType;
  /** OpenAI API key - defaults to KAP_VISION_API_KEY then OPENAI_API_KEY env */
  apiKey?: string;
  /** Base URL for OpenAI-compatible API - defaults to KAP_VISION_BASE_URL env */
  baseURL?: string;
  /** Model to use - defaults to KAP_VISION_MODEL env */
  model?: string;
  /** Concurrency - defaults to KAP_VISION_CONCURRENCY env */
  concurrency?: number;
}

/**
 * Error thrown when provider configuration is invalid.
 */
export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationError";
  }
}

/**
 * Resolve API key from config or environment.
 * KAP_VISION_API_KEY takes priority over OPENAI_API_KEY for backwards compat.
 */
function resolveApiKey(configApiKey?: string): string | undefined {
  return configApiKey
    ?? process.env.KAP_VISION_API_KEY
    ?? process.env.OPENAI_API_KEY;
}

/**
 * Create a vision provider based on configuration.
 *
 * @param config - Optional configuration overrides
 * @returns Configured VisionProvider
 * @throws ProviderConfigurationError if configuration is invalid
 *
 * Usage:
 * ```typescript
 * const provider = createProvider();
 * // or
 * const provider = createProvider({ providerType: "mock" });
 * ```
 */
export function createProvider(config: ProviderFactoryConfig = {}): VisionProvider {
  const providerType = config.providerType
    ?? (process.env.KAP_ANALYZER_PROVIDER as ProviderType | undefined)
    ?? "openai";

  switch (providerType) {
    case "openai": {
      const apiKey = resolveApiKey(config.apiKey);
      if (!apiKey) {
        throw new ProviderConfigurationError(
          "OpenAI-compatible Vision provider is not configured. "
          + "Set the KAP_VISION_API_KEY environment variable.\n\n"
          + "Example:\n"
          + "  export KAP_VISION_API_KEY=sk-...\n\n"
          + "Or use the mock provider for development:\n"
          + "  KAP_ANALYZER_PROVIDER=mock"
        );
      }

      return new OpenAIVisionProvider({
        apiKey,
        baseURL: config.baseURL,
        model: config.model,
        concurrency: config.concurrency,
      });
    }

    case "mock": {
      console.warn(
        "⚠️  MockProvider selected. "
        + "This is for DEVELOPMENT/TESTING ONLY. "
        + "Results are NOT from real AI analysis."
      );
      return new MockProvider();
    }

    default:
      throw new ProviderConfigurationError(
        `Unknown provider type: "${providerType}". `
        + `Valid options: "openai", "mock"`
      );
  }
}

/**
 * Check if the OpenAI provider is configured.
 * Checks KAP_VISION_API_KEY first, then OPENAI_API_KEY.
 */
export function isOpenAIConfigured(): boolean {
  return !!(process.env.KAP_VISION_API_KEY || process.env.OPENAI_API_KEY);
}

/**
 * Get the configured provider type.
 */
export function getConfiguredProviderType(): ProviderType {
  return (process.env.KAP_ANALYZER_PROVIDER as ProviderType | undefined) ?? "openai";
}

/**
 * Get provider status information.
 */
export function getProviderStatus(): {
  configured: boolean;
  providerType: ProviderType;
  apiKeyPresent: boolean;
  model: string;
  baseUrl: string;
} {
  const providerType = getConfiguredProviderType();
  const apiKeyPresent = !!(process.env.KAP_VISION_API_KEY || process.env.OPENAI_API_KEY);
  const model = process.env.KAP_VISION_MODEL ?? "gpt-4o";
  const baseUrl = (process.env.KAP_VISION_BASE_URL ?? "http://localhost:20333/v1")
    .trim().replace(/\/+$/, "");

  return {
    configured: providerType === "mock" || apiKeyPresent,
    providerType,
    apiKeyPresent,
    model,
    baseUrl,
  };
}
