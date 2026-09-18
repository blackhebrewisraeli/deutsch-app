// Dispatch an already-validated AI body to the vendor named on the catalog
// row. Today that is only Anthropic; ADAPTERS is the registration point for
// a second provider (see src/lib/ai-routing/providers.js).

import { forwardToAnthropic } from './anthropic.js';
import { ANTHROPIC_PROVIDER, providerForModelId } from '../../src/lib/ai-routing/providers.js';

export const ADAPTERS = Object.freeze({
  [ANTHROPIC_PROVIDER]: Object.freeze({
    envKey: 'ANTHROPIC_API_KEY',
    forward: forwardToAnthropic,
  }),
});

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isAnyProviderConfigured(env = process.env) {
  return Object.values(ADAPTERS).some((a) => Boolean(env[a.envKey]));
}

/**
 * @param {object} safeBody
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<{ status: number, data: unknown }>}
 */
export async function forwardToProvider(safeBody, env = process.env) {
  const provider = providerForModelId(safeBody?.model);
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const apiKey = env[adapter.envKey];
  if (!apiKey) {
    throw new Error(`Provider ${provider} is not configured`);
  }
  return adapter.forward(safeBody, apiKey);
}
