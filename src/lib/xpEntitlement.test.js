import { describe, it, expect, beforeEach } from 'vitest';
import { setLevelBoostEnabled, isLevelBoostEnabled } from './xpEntitlement';

describe('xpEntitlement', () => {
  beforeEach(() => setLevelBoostEnabled(false));

  it('defaults to off so a guest and a test both get flat XP', () => {
    expect(isLevelBoostEnabled()).toBe(false);
  });

  it('round-trips the flag', () => {
    setLevelBoostEnabled(true);
    expect(isLevelBoostEnabled()).toBe(true);
    setLevelBoostEnabled(false);
    expect(isLevelBoostEnabled()).toBe(false);
  });

  it('coerces truthy and falsy values to booleans', () => {
    setLevelBoostEnabled('yes');
    expect(isLevelBoostEnabled()).toBe(true);
    setLevelBoostEnabled(undefined);
    expect(isLevelBoostEnabled()).toBe(false);
  });
});
