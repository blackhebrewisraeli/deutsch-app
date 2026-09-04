// Pure model picker. No fetch, no storage, no React — callers pass a
// context object and get { model, maxTokens, profile } back. Wiring this
// into callClaude / ALLOWED_MODELS is a follow-up; this module only decides.
import {
  MODELS,
  TASKS,
  TIERS,
  COMPLEXITY_BUMP_AT,
  MAX_CAPABILITY,
  DEFAULT_TIER,
} from './catalog.js';

/**
 * @typedef {object} RouteContext
 * @property {keyof typeof TASKS} taskType
 * @property {keyof typeof TIERS} [userTier]
 * @property {number} [complexityScore]
 * @property {number} [expectedLatency]
 *
 * @typedef {object} RouteConfig
 * @property {string} model
 * @property {number} maxTokens
 * @property {'fast' | 'balanced' | 'capable'} profile
 */

/**
 * @param {RouteContext} context
 * @returns {RouteConfig}
 */
export function routeAiRequest(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new TypeError('routeAiRequest requires a context object');
  }

  const task = TASKS[context.taskType];
  if (!task) {
    throw new TypeError(
      `Unknown taskType ${JSON.stringify(context.taskType)}; expected one of ${Object.keys(TASKS).join(', ')}`
    );
  }

  const tier = TIERS[context.userTier] ?? TIERS[DEFAULT_TIER];
  const required = requiredCapability(task, clamp01(context.complexityScore));
  const budget = latencyBudget(context.expectedLatency, task.defaultLatencyMs);

  const eligible = Object.values(MODELS).filter((m) => m.cost <= tier.maxCost);
  const capable = eligible.filter((m) => m.capability >= required);
  const chosen = pick(capable, eligible, budget);

  return {
    model: chosen.id,
    maxTokens: task.maxTokens,
    profile: chosen.profile,
  };
}

function pick(capable, eligible, budget) {
  if (capable.length > 0) {
    const timely = capable.filter((m) => m.latencyMs <= budget);
    // Latency never upgrades, and never drops below the floor when a capable
    // model exists — a tight budget still returns Sonnet for an allowed chat.
    return timely.length > 0 ? cheapestThenCapable(timely) : fastest(capable);
  }
  // Nothing in-tier meets the floor (Guest chat, Free+Opus-level complexity).
  // Spend up to the ceiling rather than collapsing to the cheapest model.
  const timely = eligible.filter((m) => m.latencyMs <= budget);
  return mostCapableThenFast(timely.length > 0 ? timely : eligible);
}

function requiredCapability(task, complexity) {
  const bumped = complexity >= COMPLEXITY_BUMP_AT ? task.minCapability + 1 : task.minCapability;
  return Math.min(bumped, MAX_CAPABILITY);
}

function latencyBudget(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function cheapestThenCapable(models) {
  return models.reduce((best, m) => {
    if (m.cost !== best.cost) return m.cost < best.cost ? m : best;
    if (m.capability !== best.capability) return m.capability > best.capability ? m : best;
    return m.latencyMs < best.latencyMs ? m : best;
  });
}

function mostCapableThenFast(models) {
  return models.reduce((best, m) => {
    if (m.capability !== best.capability) return m.capability > best.capability ? m : best;
    return m.latencyMs < best.latencyMs ? m : best;
  });
}

function fastest(models) {
  return models.reduce((best, m) => (m.latencyMs < best.latencyMs ? m : best));
}
