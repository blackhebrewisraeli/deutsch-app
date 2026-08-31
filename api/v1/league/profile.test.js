import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../_lib/supabase.js', () => ({ serviceClient: vi.fn() }));
vi.mock('../../_lib/auth-middleware.js', () => ({ requireAuth: vi.fn() }));

import handler, { longestStreak } from './profile.js';
import { serviceClient } from '../../_lib/supabase.js';
import { requireAuth } from '../../_lib/auth-middleware.js';
import { createRes } from '../../_lib/test-helpers.js';

const USER = { userId: 'me', email: 'a@b.com' };
const req = (userId) => ({
  method: 'GET',
  query: { userId },
  headers: { authorization: 'Bearer t' },
});

afterEach(() => vi.clearAllMocks());

describe('longestStreak', () => {
  it('finds the longest run of consecutive days', () => {
    expect(longestStreak(['2026-06-20', '2026-06-21', '2026-06-23'])).toBe(2);
    expect(longestStreak([])).toBe(0);
  });
});

it('rejects when requester shares no league with target (403)', async () => {
  requireAuth.mockResolvedValue(USER);
  const sharedRpc = vi.fn().mockResolvedValue({ data: false, error: null });
  serviceClient.mockReturnValue({ rpc: sharedRpc });
  const res = createRes();
  await handler(req('other'), res);
  expect(res.statusCode).toBe(403);
});

it('returns 400 when userId missing', async () => {
  requireAuth.mockResolvedValue(USER);
  serviceClient.mockReturnValue({ rpc: vi.fn() });
  const res = createRes();
  await handler(req(undefined), res);
  expect(res.statusCode).toBe(400);
});

// ── The passport payload ──────────────────────────────────────

import { joinYear, publicAchievements } from './profile.js';

describe('joinYear', () => {
  it('is the year alone, never the date', () => {
    expect(joinYear('2026-06-19T10:20:30Z')).toBe(2026);
  });

  it('is null when unknown', () => {
    expect(joinYear(null)).toBeNull();
    expect(joinYear(undefined)).toBeNull();
    expect(joinYear('not a date')).toBeNull();
  });
});

// Badges are READ from what the learner's own client synced, never recomputed.
// The decisive case is real: the only badge on the production account is
// `deck1`, which depends on deck mastery — a server recomputation from public
// activity could not have produced it at all.
describe('publicAchievements', () => {
  it('returns the earned ids', () => {
    expect(publicAchievements({ achievements: { vol100: 5, deck1: 9 } })).toEqual([
      'vol100',
      'deck1',
    ]);
  });

  it('orders them oldest-earned first, so a passport reads as a history', () => {
    expect(publicAchievements({ achievements: { late: 900, early: 100, mid: 500 } })).toEqual([
      'early',
      'mid',
      'late',
    ]);
  });

  it('does NOT leak the earned timestamps', () => {
    const out = publicAchievements({ achievements: { vol100: 1785469058935 } });
    expect(out).toEqual(['vol100']);
    expect(JSON.stringify(out)).not.toContain('1785469058935');
  });

  it('is empty for a learner who has never synced', () => {
    expect(publicAchievements(undefined)).toEqual([]);
    expect(publicAchievements({})).toEqual([]);
    expect(publicAchievements({ achievements: null })).toEqual([]);
  });

  it('ignores a corrupted shape rather than throwing', () => {
    expect(publicAchievements({ achievements: ['vol100'] })).toEqual([]);
    expect(publicAchievements({ achievements: 'vol100' })).toEqual([]);
  });
});

// A full-payload mock: enough tables that the handler's Promise.all resolves.
const passportDb = (over = {}) => {
  const rows = {
    profiles: {
      handle: 'Rival',
      avatar_emoji: '\u{1F98A}',
      avatar_path: 'other/a.webp',
      created_at: '2026-06-19T00:00:00Z',
      ...over.profile,
    },
    stats_daily: over.stats ?? [
      { day: '2026-06-20', counters: { byLevel: { a1: { correct: 10 } } } },
      { day: '2026-06-21', counters: { byLevel: { a1: { correct: 10 } } } },
    ],
    wins: over.wins ?? [{ league_id: 'l1' }, { league_id: 'l2' }],
    settings:
      'settings' in over ? over.settings : { data: { achievements: { deck1: 100, vol100: 200 } } },
  };
  return {
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    from: vi.fn((table) => {
      const q = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        order: vi.fn(() => q),
        limit: vi.fn(() => q),
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data:
              table === 'profiles'
                ? rows.profiles
                : table === 'settings'
                  ? rows.settings
                  : { leagues: { tier: 1 } },
          })
        ),
        then: (resolve) =>
          resolve({
            data: table === 'stats_daily' ? rows.stats_daily : rows.wins,
            error: null,
          }),
      };
      return q;
    }),
  };
};

describe('GET /api/v1/league/profile — the passport', () => {
  it('carries every field the card renders', async () => {
    requireAuth.mockResolvedValue(USER);
    serviceClient.mockReturnValue(passportDb());
    const res = createRes();
    await handler(req('other'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      handle: 'Rival',
      avatar_path: 'other/a.webp',
      join_year: 2026,
      tier: 1,
      total_xp: 200,
      longest_streak: 2,
      league_wins: 2,
      achievements: ['deck1', 'vol100'],
    });
  });

  // The client's stats.leagueWins has NEVER synced — `stats` is absent from
  // settingsToRow's allowlist — so the server is the only correct source.
  it('counts league wins from rank-1 memberships', async () => {
    requireAuth.mockResolvedValue(USER);
    serviceClient.mockReturnValue(passportDb({ wins: [] }));
    const res = createRes();
    await handler(req('other'), res);
    expect(res.body.league_wins).toBe(0);
  });

  it('is empty-but-valid for a player who has never synced settings', async () => {
    requireAuth.mockResolvedValue(USER);
    serviceClient.mockReturnValue(passportDb({ settings: null }));
    const res = createRes();
    await handler(req('other'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.achievements).toEqual([]);
  });

  it('returns nothing from the settings row except the badge ids', async () => {
    requireAuth.mockResolvedValue(USER);
    serviceClient.mockReturnValue(
      passportDb({
        settings: {
          data: {
            achievements: { deck1: 1 },
            goal: 100,
            soundOn: true,
            learnedWords: { Haus: true },
            level: 'b1',
          },
        },
      })
    );
    const res = createRes();
    await handler(req('other'), res);

    const body = JSON.stringify(res.body);
    expect(res.body.achievements).toEqual(['deck1']);
    for (const leak of ['goal', 'soundOn', 'learnedWords', 'Haus', 'b1']) {
      expect(body).not.toContain(leak);
    }
  });

  it('lets a learner fetch their OWN passport without a league check', async () => {
    requireAuth.mockResolvedValue(USER);
    const db = passportDb();
    serviceClient.mockReturnValue(db);
    const res = createRes();
    await handler(req(USER.userId), res);
    expect(res.statusCode).toBe(200);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
