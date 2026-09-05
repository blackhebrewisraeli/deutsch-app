import { describe, it, expect } from 'vitest';
import { compareMigrations, localNamesFrom } from './compare.js';

// The failure this guards: E4 (#237) merged with
// 20260904140000_progress_events_seen.sql and it was never applied to
// production. That migration changed apply_progress_event's ARITY, so the
// deployed endpoint called an 8-arg RPC against a 7-arg database and every
// progress write failed for ~26h with no fallback writer.

const remote = (...pairs) => pairs.map(([version, name]) => ({ version, name }));

describe('localNamesFrom', () => {
  it('strips the version prefix and the .sql suffix', () => {
    expect(localNamesFrom(['20260904140000_progress_events_seen.sql'])).toEqual([
      {
        version: '20260904140000',
        name: 'progress_events_seen',
        file: '20260904140000_progress_events_seen.sql',
      },
    ]);
  });

  it('ignores anything that is not a .sql file', () => {
    expect(localNamesFrom(['README.md', '.gitkeep', '20260101000000_a.sql'])).toHaveLength(1);
  });

  it('keeps underscores inside the name', () => {
    expect(localNamesFrom(['20260612201311_data_api_explicit_grants.sql'])[0].name).toBe(
      'data_api_explicit_grants'
    );
  });
});

describe('compareMigrations — the version numbers deliberately do not match', () => {
  it('matches on NAME even when every version differs', () => {
    // Real data from this project: migrations applied through the MCP stamp
    // their own application time, so repo 20260904120000_lessons.sql is remote
    // version 20260904063154. A version-based diff reports every one of these
    // as missing and is useless here.
    const result = compareMigrations(
      ['20260904120000_lessons.sql', '20260904121000_apply_progress_event.sql'],
      remote(['20260904063154', 'lessons'], ['20260904063216', 'apply_progress_event'])
    );
    expect(result.unapplied).toEqual([]);
    expect(result.untracked).toEqual([]);
    expect(result.matchedBy).toBe('name');
  });

  it('reports a repo migration the database has never applied', () => {
    const result = compareMigrations(
      ['20260904121000_apply_progress_event.sql', '20260904140000_progress_events_seen.sql'],
      remote(['20260904063216', 'apply_progress_event'])
    );
    expect(result.unapplied.map((m) => m.name)).toEqual(['progress_events_seen']);
    expect(result.ok).toBe(false);
  });

  it('reports unapplied migrations in repo order, oldest first', () => {
    const result = compareMigrations(
      ['20260903000000_b.sql', '20260901000000_a.sql', '20260905000000_c.sql'],
      remote(['20260901000000', 'a'])
    );
    expect(result.unapplied.map((m) => m.name)).toEqual(['b', 'c']);
  });

  it('reports a migration applied to the database but absent from the repo', () => {
    // Someone ran SQL by hand. Not fatal — the repo is still the source of
    // truth for what SHOULD exist — but it must be visible.
    const result = compareMigrations(['20260101000000_a.sql'], remote(['20260101000000', 'a'], ['20260202000000', 'hotfix_by_hand']));
    expect(result.untracked.map((m) => m.name)).toEqual(['hotfix_by_hand']);
    expect(result.ok).toBe(true);
  });
});

describe('compareMigrations — the check must not pass vacuously', () => {
  it('an EMPTY remote list is a failure, not "everything is applied"', () => {
    // An empty result set and "all clear" print identically. A 401, a wrong
    // project ref, or a shape change would otherwise read as a green check.
    const result = compareMigrations(['20260101000000_a.sql'], []);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no applied migrations/i);
  });

  it('an EMPTY local list is a failure — the glob found nothing', () => {
    const result = compareMigrations([], remote(['20260101000000', 'a']));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no migration files/i);
  });

  it('refuses to compare when the API returned rows carrying no name', () => {
    // "List applied migration VERSIONS" — the response shape is undocumented.
    // If names ever stop coming back, silently falling back to version
    // matching would report every MCP-applied migration as unapplied. Fail
    // loudly instead of guessing.
    const result = compareMigrations(['20260101000000_a.sql'], [{ version: '20260101000000' }]);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/name/i);
  });

  it('surfaces a duplicate local name rather than matching it twice', () => {
    const result = compareMigrations(
      ['20260101000000_a.sql', '20260202000000_a.sql'],
      remote(['20260101000000', 'a'])
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/duplicate/i);
  });

  it('surfaces a filename that has no version_name shape', () => {
    const result = compareMigrations(['nonsense.sql'], remote(['20260101000000', 'a']));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/could not be parsed|unparsable/i);
  });

  it('reports what it actually compared, so a green run is auditable', () => {
    const result = compareMigrations(
      ['20260101000000_a.sql', '20260202000000_b.sql'],
      remote(['20260101000000', 'a'], ['99999999999999', 'b'])
    );
    expect(result).toMatchObject({ ok: true, localCount: 2, remoteCount: 2 });
  });
});
