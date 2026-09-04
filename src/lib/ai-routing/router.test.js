import { describe, it, expect } from 'vitest';
import { routeAiRequest } from './router.js';
import { MODELS, TASKS, COMPLEXITY_BUMP_AT } from './catalog.js';

const haiku = MODELS.haiku.id;
const sonnet = MODELS.sonnet.id;
const opus = MODELS.opus.id;

function route(overrides) {
  return routeAiRequest({ taskType: 'translation_check', ...overrides });
}

describe('routeAiRequest', () => {
  describe('capability vs cost vs speed', () => {
    it.each([
      {
        name: 'guest translation check stays on Haiku',
        ctx: { taskType: 'translation_check', userTier: 'guest' },
        model: haiku,
        profile: 'fast',
        maxTokens: TASKS.translation_check.maxTokens,
      },
      {
        name: 'free translation check stays on Haiku — cost still wins',
        ctx: { taskType: 'translation_check', userTier: 'free' },
        model: haiku,
        profile: 'fast',
        maxTokens: TASKS.translation_check.maxTokens,
      },
      {
        name: 'pro translation check stays on Haiku — tier is a ceiling, not a floor',
        ctx: { taskType: 'translation_check', userTier: 'pro' },
        model: haiku,
        profile: 'fast',
        maxTokens: TASKS.translation_check.maxTokens,
      },
      {
        name: 'complex free translation check promotes to Sonnet',
        ctx: {
          taskType: 'translation_check',
          userTier: 'free',
          complexityScore: COMPLEXITY_BUMP_AT,
        },
        model: sonnet,
        profile: 'balanced',
        maxTokens: TASKS.translation_check.maxTokens,
      },
      {
        name: 'complex guest translation check stays on Haiku — ceiling wins',
        ctx: {
          taskType: 'translation_check',
          userTier: 'guest',
          complexityScore: 0.95,
        },
        model: haiku,
        profile: 'fast',
        maxTokens: TASKS.translation_check.maxTokens,
      },
      {
        name: 'complex pro translation check is Sonnet, not Opus — required cap is 2',
        ctx: {
          taskType: 'translation_check',
          userTier: 'pro',
          complexityScore: COMPLEXITY_BUMP_AT,
        },
        model: sonnet,
        profile: 'balanced',
        maxTokens: TASKS.translation_check.maxTokens,
      },
      {
        name: 'guest chat degrades to Haiku',
        ctx: { taskType: 'chat', userTier: 'guest' },
        model: haiku,
        profile: 'fast',
        maxTokens: TASKS.chat.maxTokens,
      },
      {
        name: 'free chat uses Sonnet',
        ctx: { taskType: 'chat', userTier: 'free' },
        model: sonnet,
        profile: 'balanced',
        maxTokens: TASKS.chat.maxTokens,
      },
      {
        name: 'pro chat uses Sonnet when complexity is ordinary',
        ctx: { taskType: 'chat', userTier: 'pro' },
        model: sonnet,
        profile: 'balanced',
        maxTokens: TASKS.chat.maxTokens,
      },
      {
        name: 'complex pro chat uses Opus',
        ctx: { taskType: 'chat', userTier: 'pro', complexityScore: COMPLEXITY_BUMP_AT },
        model: opus,
        profile: 'capable',
        maxTokens: TASKS.chat.maxTokens,
      },
      {
        name: 'complex free chat cannot buy Opus',
        ctx: { taskType: 'chat', userTier: 'free', complexityScore: 0.99 },
        model: sonnet,
        profile: 'balanced',
        maxTokens: TASKS.chat.maxTokens,
      },
      {
        name: 'free grammar generation uses Sonnet',
        ctx: { taskType: 'grammar_generation', userTier: 'free' },
        model: sonnet,
        profile: 'balanced',
        maxTokens: TASKS.grammar_generation.maxTokens,
      },
      {
        name: 'complex pro grammar generation uses Opus',
        ctx: {
          taskType: 'grammar_generation',
          userTier: 'pro',
          complexityScore: 0.75,
        },
        model: opus,
        profile: 'capable',
        maxTokens: TASKS.grammar_generation.maxTokens,
      },
      {
        name: 'guest deck generation stays on Haiku',
        ctx: { taskType: 'deck_generation', userTier: 'guest' },
        model: haiku,
        profile: 'fast',
        maxTokens: TASKS.deck_generation.maxTokens,
      },
      {
        name: 'ordinary pro deck generation uses Sonnet',
        ctx: { taskType: 'deck_generation', userTier: 'pro' },
        model: sonnet,
        profile: 'balanced',
        maxTokens: TASKS.deck_generation.maxTokens,
      },
      {
        name: 'complex pro deck generation uses Opus',
        ctx: { taskType: 'deck_generation', userTier: 'pro', complexityScore: 0.85 },
        model: opus,
        profile: 'capable',
        maxTokens: TASKS.deck_generation.maxTokens,
      },
    ])('$name', ({ ctx, model, profile, maxTokens }) => {
      expect(routeAiRequest(ctx)).toEqual({ model, profile, maxTokens });
    });
  });

  describe('latency budget', () => {
    it('does not upgrade Haiku just because the budget is generous', () => {
      expect(route({ userTier: 'pro', expectedLatency: 20_000 }).model).toBe(haiku);
    });

    it('does not downgrade an allowed Sonnet chat to Haiku when the budget is tight', () => {
      const result = routeAiRequest({
        taskType: 'chat',
        userTier: 'free',
        expectedLatency: 500,
      });
      expect(result.model).toBe(sonnet);
    });

    it('picks Haiku for a simple check when both Haiku and Sonnet fit the budget', () => {
      // Free + no complexity: required cap 1, both models are eligible, Haiku is cheaper.
      expect(route({ userTier: 'free', expectedLatency: 10_000 }).model).toBe(haiku);
    });

    it('still returns Opus when it is the only capable model over budget', () => {
      const result = routeAiRequest({
        taskType: 'grammar_generation',
        userTier: 'pro',
        complexityScore: 0.9,
        expectedLatency: 400,
      });
      expect(result.model).toBe(opus);
    });

    it('uses the task default budget when expectedLatency is missing or unusable', () => {
      expect(route({ userTier: 'free' }).model).toBe(haiku);
      expect(route({ userTier: 'free', expectedLatency: 0 }).model).toBe(haiku);
      expect(route({ userTier: 'free', expectedLatency: -50 }).model).toBe(haiku);
      expect(route({ userTier: 'free', expectedLatency: Number.NaN }).model).toBe(haiku);
    });
  });

  describe('input hygiene', () => {
    it('throws when context is missing or not an object', () => {
      expect(() => routeAiRequest()).toThrow(TypeError);
      expect(() => routeAiRequest(null)).toThrow(TypeError);
      expect(() => routeAiRequest('chat')).toThrow(TypeError);
      expect(() => routeAiRequest(['chat'])).toThrow(TypeError);
    });

    it('throws on an unknown or missing taskType', () => {
      expect(() => routeAiRequest({})).toThrow(/taskType/);
      expect(() => routeAiRequest({ taskType: 'summarise' })).toThrow(/summarise/);
      expect(() => routeAiRequest({ taskType: 'grade' })).toThrow(/grade/);
    });

    it('defaults a missing tier to guest (fail cheap)', () => {
      expect(routeAiRequest({ taskType: 'chat' }).model).toBe(haiku);
    });

    it('treats an unknown tier as guest', () => {
      expect(route({ userTier: 'Pro' }).model).toBe(haiku);
      expect(routeAiRequest({ taskType: 'chat', userTier: 'enterprise' }).model).toBe(haiku);
    });

    it('clamps complexity into 0–1', () => {
      expect(route({ userTier: 'free', complexityScore: 1.5 }).model).toBe(sonnet);
      expect(route({ userTier: 'free', complexityScore: -1 }).model).toBe(haiku);
      expect(route({ userTier: 'free', complexityScore: 'nope' }).model).toBe(haiku);
    });

    it('ignores extra fields', () => {
      expect(route({ userTier: 'free', endpoint: 'grade', prompt: 'secret' }).model).toBe(haiku);
    });
  });
});
