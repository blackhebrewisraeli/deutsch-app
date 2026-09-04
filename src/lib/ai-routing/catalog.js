// Policy data for the AI router. Tune scores here; router.js only ranks
// what this file lists. Model ids are the routing contract — they are not
// sent anywhere until a follow-up expands ALLOWED_MODELS and callClaude.
//
// Haiku's id is the production pin already hardcoded in src/lib/claude.js.
// Sonnet and Opus are family ids, not dated pins: they are not on the
// allow-list yet, and inventing a date here would pretend they are.

export const COMPLEXITY_BUMP_AT = 0.7;
export const MAX_CAPABILITY = 3;
export const DEFAULT_TIER = 'guest';

export const MODELS = Object.freeze({
  haiku: Object.freeze({
    id: 'claude-haiku-4-5-20251001',
    capability: 1,
    cost: 1,
    latencyMs: 400,
    profile: 'fast',
  }),
  sonnet: Object.freeze({
    id: 'claude-sonnet-4-5',
    capability: 2,
    cost: 2,
    latencyMs: 1200,
    profile: 'balanced',
  }),
  opus: Object.freeze({
    id: 'claude-opus-4-1',
    capability: 3,
    cost: 3,
    latencyMs: 2800,
    profile: 'capable',
  }),
});

export const TASKS = Object.freeze({
  translation_check: Object.freeze({
    minCapability: 1,
    defaultLatencyMs: 800,
    maxTokens: 512,
  }),
  chat: Object.freeze({
    minCapability: 2,
    defaultLatencyMs: 2500,
    maxTokens: 1000,
  }),
  grammar_generation: Object.freeze({
    minCapability: 2,
    defaultLatencyMs: 4000,
    maxTokens: 1024,
  }),
  deck_generation: Object.freeze({
    minCapability: 2,
    defaultLatencyMs: 8000,
    maxTokens: 1024,
  }),
});

export const TIERS = Object.freeze({
  guest: Object.freeze({ maxCost: 1 }),
  free: Object.freeze({ maxCost: 2 }),
  pro: Object.freeze({ maxCost: 3 }),
});
