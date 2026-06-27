import { describe, it, expect } from 'vitest';
import { weekRemaining } from './leagueCountdown.js';

// period_start 2026-06-22 (Mon) → week ends 2026-06-29 00:00 UTC.
const PERIOD = '2026-06-22';

describe('weekRemaining', () => {
  it('shows days + hours when more than a day remains', () => {
    const now = new Date('2026-06-25T20:00:00Z'); // 3d 4h before end
    expect(weekRemaining(PERIOD, now)).toEqual({ ended: false, label: '3d 4h' });
  });

  it('shows hours + minutes within the final day', () => {
    const now = new Date('2026-06-28T21:30:00Z'); // 2h 30m before end
    expect(weekRemaining(PERIOD, now)).toEqual({ ended: false, label: '2h 30m' });
  });

  it('shows minutes only in the final hour', () => {
    const now = new Date('2026-06-28T23:45:00Z'); // 15m before end
    expect(weekRemaining(PERIOD, now)).toEqual({ ended: false, label: '15m' });
  });

  it('reports ended once the week has elapsed', () => {
    const now = new Date('2026-06-29T00:00:01Z');
    expect(weekRemaining(PERIOD, now).ended).toBe(true);
  });
});
