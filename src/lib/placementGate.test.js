import { describe, it, expect } from 'vitest';
import { shouldOpenPlacement } from './placementGate.js';

describe('shouldOpenPlacement', () => {
  it('opens for a guest with no stored level — the first-time learner', () => {
    expect(shouldOpenPlacement({ hasLevel: false, authStatus: 'anonymous' })).toBe(true);
  });

  it('stays shut for a returning learner with a stored level', () => {
    expect(shouldOpenPlacement({ hasLevel: true, authStatus: 'anonymous' })).toBe(false);
    expect(shouldOpenPlacement({ hasLevel: true, authStatus: 'authenticated' })).toBe(false);
  });

  it('stays shut while auth is still resolving', () => {
    // The takeover is full-screen. Guessing here is how the README "Live demo"
    // link landed on "Find your level" with no guest/sign-in choice at all.
    expect(shouldOpenPlacement({ hasLevel: false, authStatus: 'loading' })).toBe(false);
  });

  it('waits for the first sync reconcile before classifying a signed-in learner', () => {
    // The regression this file exists for: the CEFR code was on the server
    // (settings.data.level) and had not been pulled down yet.
    expect(
      shouldOpenPlacement({
        hasLevel: false,
        authStatus: 'authenticated',
        syncEnabled: true,
        syncSettled: false,
      })
    ).toBe(false);
  });

  it('opens once that reconcile came back with no level', () => {
    expect(
      shouldOpenPlacement({
        hasLevel: false,
        authStatus: 'authenticated',
        syncEnabled: true,
        syncSettled: true,
      })
    ).toBe(true);
  });

  it('does not wait forever when sync is switched off', () => {
    // No server to hear from, so `syncSettled` can never become true. Waiting
    // on it would mean a signed-in learner with sync off never gets placed.
    expect(
      shouldOpenPlacement({
        hasLevel: false,
        authStatus: 'authenticated',
        syncEnabled: false,
        syncSettled: false,
      })
    ).toBe(true);
  });

  it('never waits on sync for an anonymous learner', () => {
    // A guest has no server settings row to pull, so the sync gate must not
    // apply to them — it would hold the test shut for the one person it is for.
    expect(
      shouldOpenPlacement({
        hasLevel: false,
        authStatus: 'anonymous',
        syncEnabled: true,
        syncSettled: false,
      })
    ).toBe(true);
  });

  it('defaults to not opening when called with nothing', () => {
    expect(shouldOpenPlacement()).toBe(true);
    expect(shouldOpenPlacement({})).toBe(true);
  });
});
