import { describe, it, expect } from 'vitest';
import { resolveRelease } from './resolveRelease.js';

// Nothing else asserts this order, and a wrong answer still yields a perfectly
// plausible build — the Sentry release stamp is just silently missing or stale,
// and you find out when an error cannot be tied to a deploy.
describe('resolveRelease', () => {
  it('prefers an explicit override above everything', () => {
    expect(
      resolveRelease({
        VITE_SENTRY_RELEASE: 'explicit',
        VERCEL_GIT_COMMIT_SHA: 'vercel',
        GITHUB_SHA: 'gha',
      })
    ).toBe('explicit');
  });

  it('falls back to Vercel before GitHub Actions', () => {
    expect(resolveRelease({ VERCEL_GIT_COMMIT_SHA: 'vercel', GITHUB_SHA: 'gha' })).toBe('vercel');
  });

  it('uses GITHUB_SHA when it is the only one set', () => {
    expect(resolveRelease({ GITHUB_SHA: 'gha' })).toBe('gha');
  });

  // Empty string, not undefined and not 'unknown': observability.js turns ''
  // back into undefined so Sentry records no release, rather than grouping every
  // unstamped build under one literal.
  it('is an empty string when nothing resolves', () => {
    expect(resolveRelease({})).toBe('');
  });

  // A var that is set but empty must not win. `||` handles it; a future rewrite
  // to `??` would silently stamp the release as '' and pass every other test here.
  it('skips a variable that is set but empty', () => {
    expect(resolveRelease({ VITE_SENTRY_RELEASE: '', VERCEL_GIT_COMMIT_SHA: 'vercel' })).toBe(
      'vercel'
    );
  });

  // The point of dropping the git fallback: no subprocess, so this resolves in a
  // git-less tree (or with a hostile PATH) instead of shelling out.
  it('consults no subprocess — a git-less environment still resolves', () => {
    expect(resolveRelease({ PATH: '/nonexistent' })).toBe('');
  });
});
