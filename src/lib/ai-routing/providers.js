// Provider lookup for catalog model ids. The client never talks to a vendor;
// this module only names which adapter the server should call.
//
// How a second provider plugs in (not live in this MVP — no OpenAI/Google
// key is required to ship):
//   1. Add catalog rows with `provider: 'openai'` (or 'google') and a unique id.
//   2. Implement `forwardToOpenAI(safeBody, apiKey)` next to `forwardToAnthropic`.
//   3. Register it on `ADAPTERS` in `api/_lib/forward.js` with envKey
//      `OPENAI_API_KEY` (never a VITE_ prefix — Vite would inline it).
//   4. Set the key in Vercel. `isAnyProviderConfigured` then treats it as
//      sufficient so Anthropic is no longer a hard dependency.
//   5. Point a preference profile at the new row, or add a picker id.
// Until those rows exist they are not on ALLOWED_MODELS, so production cannot
// accidentally route to a missing vendor.

import { MODELS } from './catalog.js';

export const ANTHROPIC_PROVIDER = 'anthropic';

/**
 * @param {unknown} modelId
 * @returns {string}
 */
export function providerForModelId(modelId) {
  if (typeof modelId !== 'string' || !modelId) return ANTHROPIC_PROVIDER;
  const model = Object.values(MODELS).find((m) => m.id === modelId);
  return model?.provider ?? ANTHROPIC_PROVIDER;
}
