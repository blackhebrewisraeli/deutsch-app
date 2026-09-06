import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { XP_PER_VERDICT } from '../../src/lib/gameConfig.js';

// The XP formula now exists TWICE: xpForDay in src/lib/xpCore.js, and
// progress_day_xp in the L1 migration. SQL cannot import gameConfig, so the
// verdict weights are duplicated into the migration by hand. Nothing but this
// test stands between the two lanes and silent drift — and drift here is
// invisible in the product: the leaderboard would simply disagree with the XP
// the learner watched themselves earn.
//
// This test is green the day it is written, so it proves nothing on its own.
// Its teeth were established by mutation: changing XP_PER_VERDICT.almost from
// 6 to 7 fails it, as does changing the `* 6` in the migration.

// cwd-relative, matching the repo's other source-scanning guards
// (src/components/noHardcodedColors.test.js).
const MIGRATION = 'supabase/migrations/20260905203500_league_xp_from_progress_event.sql';

const sql = readFileSync(MIGRATION, 'utf8');

// The three weighted terms inside progress_day_xp, e.g.
//   coalesce((lv.value->>'correct')::integer, 0) * 10
const weightOf = (verdict) => {
  const m = sql.match(
    new RegExp(`lv\\.value->>'${verdict}'\\)::integer,\\s*0\\)\\s*\\*\\s*(\\d+)`)
  );
  return m ? Number(m[1]) : null;
};

describe('the SQL XP formula matches the JS one', () => {
  it('weights every verdict exactly as XP_PER_VERDICT does', () => {
    // Fails loudly if the regex stops matching, rather than comparing null to
    // null and reporting success — an assertion that cannot find its subject
    // is not a passing assertion.
    for (const verdict of ['correct', 'almost', 'wrong']) {
      expect(weightOf(verdict), `no weight found in SQL for '${verdict}'`).not.toBeNull();
    }
    expect(weightOf('correct')).toBe(XP_PER_VERDICT.correct);
    expect(weightOf('almost')).toBe(XP_PER_VERDICT.almost);
    expect(weightOf('wrong')).toBe(XP_PER_VERDICT.wrong);
  });

  it('covers every verdict the JS formula knows about', () => {
    // If a fourth verdict is ever added to gameConfig, this fails until the
    // migration learns about it. The audit asserts its own coverage instead of
    // silently checking three of four.
    expect(Object.keys(XP_PER_VERDICT).sort()).toEqual(['almost', 'correct', 'wrong']);
  });

  it('adds bonusXp on top, exactly as xpForDay does', () => {
    expect(sql).toMatch(/coalesce\(\(counters->>'bonusXp'\)::integer,\s*0\)/);
  });

  it('keys the league week off the event day, not the delivery time', () => {
    // now() would attribute a queued offline event to the week it was
    // delivered rather than the week it was earned.
    expect(sql).toMatch(/v_period\s*:=\s*date_trunc\('week',\s*p_day\)::date/);
    expect(sql).not.toMatch(/date_trunc\('week',\s*now\(\)\)/);
  });

  it('keeps the RPC at eight arguments', () => {
    // E4's outage was a deployed endpoint calling an 8-arg RPC against a 7-arg
    // database. A signature change here must be a deliberate, separate act.
    const signature = sql.match(
      /create or replace function public\.apply_progress_event\(([\s\S]*?)\)\s*returns/
    );
    expect(signature).not.toBeNull();
    const args = signature[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('p_'));
    expect(args).toHaveLength(8);
  });
});
