import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// stats_daily is read-only for the Data API since 20260925120000: every XP
// reader sums it, so a client write is a free-XP faucet. This fails if the
// lockdown migration loses a statement or a LATER migration reopens writes.

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const LOCKDOWN = '20260925120000_stats_daily_read_only.sql';
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const statements = (file) =>
  readFileSync(join(migrationsDir, file), 'utf8')
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

// A statement that hands anon/authenticated a way to write stats_daily.
function opensClientWrites(stmt) {
  if (!/\bpublic\.stats_daily\b/i.test(stmt)) return false;
  const grant = stmt.match(/^grant\s+([\s\S]*?)\s+on\s+[\s\S]*\bto\s+([\s\S]*)$/i);
  if (grant) {
    return (
      /\b(insert|update|delete|truncate|all)\b/i.test(grant[1]) &&
      /\b(anon|authenticated|public)\b/i.test(grant[2])
    );
  }
  // A policy with no FOR clause applies to ALL commands.
  return /^create\s+policy\b/i.test(stmt) && !/\bfor\s+select\b/i.test(stmt);
}

const offenders = (list) =>
  list.flatMap((f) =>
    statements(f)
      .filter(opensClientWrites)
      .map(() => f)
  );

describe('stats_daily is read-only for clients', () => {
  it('the lockdown drops every write policy and leaves only SELECT granted', () => {
    const sql = statements(LOCKDOWN).join(';\n');
    for (const name of ['insert own rows', 'update own rows', 'delete own rows']) {
      expect(sql).toContain(`drop policy if exists "${name}" on public.stats_daily`);
    }
    expect(sql).toMatch(/revoke all on table public\.stats_daily from anon, authenticated/i);
    expect(sql).toMatch(/grant select on table public\.stats_daily to authenticated/i);
  });

  it('the detector catches the original own-row CRUD grants (so the next check can fail)', () => {
    const before = files.slice(0, files.indexOf(LOCKDOWN));
    expect(offenders(before)).toEqual(
      expect.arrayContaining([
        '20260611232000_user_tables.sql',
        '20260612201311_data_api_explicit_grants.sql',
        '20260613001606_revoke_legacy_data_api_privileges.sql',
      ])
    );
  });

  it('no migration after the lockdown reopens client writes', () => {
    expect(files).toContain(LOCKDOWN);
    expect(offenders(files.slice(files.indexOf(LOCKDOWN)))).toEqual([]);
  });
});
