import { describe, it, expect, beforeEach } from 'vitest';
import { stampSettings } from './settingsStamp.js';
import { loadState } from './storage.js';

describe('stampSettings', () => {
  beforeEach(() => localStorage.clear());
  it('writes a settingsUpdatedAt into the blob without dropping other fields', () => {
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ srs: { a: 1 }, gamification: { goal: 50 } })
    );
    stampSettings(1000);
    const s = loadState();
    expect(s.settingsUpdatedAt).toBe(1000);
    expect(s.srs).toEqual({ a: 1 }); // preserved
    expect(s.gamification.goal).toBe(50);
  });
});
