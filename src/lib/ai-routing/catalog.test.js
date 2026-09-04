import { describe, it, expect } from 'vitest';
import {
  MODELS,
  TASKS,
  TIERS,
  COMPLEXITY_BUMP_AT,
  MAX_CAPABILITY,
  DEFAULT_TIER,
} from './catalog.js';

describe('AI routing catalog', () => {
  it('orders models so cheaper is faster and less capable', () => {
    expect(MODELS.haiku.cost).toBeLessThan(MODELS.sonnet.cost);
    expect(MODELS.sonnet.cost).toBeLessThan(MODELS.opus.cost);
    expect(MODELS.haiku.capability).toBeLessThan(MODELS.sonnet.capability);
    expect(MODELS.sonnet.capability).toBeLessThan(MODELS.opus.capability);
    expect(MODELS.haiku.latencyMs).toBeLessThan(MODELS.sonnet.latencyMs);
    expect(MODELS.sonnet.latencyMs).toBeLessThan(MODELS.opus.latencyMs);
  });

  it('keeps Haiku on the production pin already used by callClaude', () => {
    expect(MODELS.haiku.id).toBe('claude-haiku-4-5-20251001');
    expect(MODELS.haiku.profile).toBe('fast');
    expect(MODELS.sonnet.profile).toBe('balanced');
    expect(MODELS.opus.profile).toBe('capable');
  });

  it('sets translation_check cheaper and faster than generative tasks', () => {
    expect(TASKS.translation_check.minCapability).toBeLessThan(TASKS.chat.minCapability);
    expect(TASKS.translation_check.maxTokens).toBeLessThan(TASKS.chat.maxTokens);
    expect(TASKS.translation_check.defaultLatencyMs).toBeLessThan(TASKS.chat.defaultLatencyMs);
    expect(TASKS.chat.minCapability).toBe(TASKS.grammar_generation.minCapability);
    expect(TASKS.grammar_generation.minCapability).toBe(TASKS.deck_generation.minCapability);
  });

  it('caps guest below free below pro', () => {
    expect(TIERS.guest.maxCost).toBeLessThan(TIERS.free.maxCost);
    expect(TIERS.free.maxCost).toBeLessThan(TIERS.pro.maxCost);
    expect(TIERS.pro.maxCost).toBe(MODELS.opus.cost);
    expect(DEFAULT_TIER).toBe('guest');
  });

  it('bumps complexity below 1 so a 0.7 check is reachable', () => {
    expect(COMPLEXITY_BUMP_AT).toBeGreaterThan(0);
    expect(COMPLEXITY_BUMP_AT).toBeLessThan(1);
    expect(MAX_CAPABILITY).toBe(MODELS.opus.capability);
  });
});
