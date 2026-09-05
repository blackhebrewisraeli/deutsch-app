// Pure comparison between the migrations committed to the repo and the ones a
// Supabase project has actually applied. No network, no filesystem — so every
// branch below is unit-testable, which is the point: the failure it guards
// against is silent by nature.
//
// Background: E4 (#237) merged carrying
// 20260904140000_progress_events_seen.sql, and that file was never applied to
// production. It changed apply_progress_event's ARITY, so the deployed endpoint
// called an 8-arg RPC against a 7-arg database. Every progress write failed for
// ~26 hours, with no fallback writer and nothing going red anywhere.

const FILENAME = /^(\d+)_(.+)\.sql$/;

/**
 * Parse `20260904140000_progress_events_seen.sql` into `{ version, name }`.
 * Non-.sql entries are ignored; a .sql file that does not parse is returned
 * with `name: null` so the caller can refuse to compare rather than drop it.
 */
export function localNamesFrom(filenames) {
  return filenames
    .filter((f) => f.endsWith('.sql'))
    .map((file) => {
      const m = FILENAME.exec(file);
      return m ? { version: m[1], name: m[2], file } : { version: null, name: null, file };
    });
}

function fail(reason, extra = {}) {
  return { ok: false, reason, unapplied: [], untracked: [], ...extra };
}

/**
 * @param {string[]} filenames  contents of supabase/migrations/
 * @param {{version?: string, name?: string}[]} remoteRows  applied migrations
 * @returns {{ok: boolean, reason?: string, unapplied: object[], untracked: object[],
 *            matchedBy?: string, localCount?: number, remoteCount?: number}}
 *
 * Matches on NAME, never on version. In this project the two deliberately
 * diverge: a migration applied through the MCP is stamped with its APPLICATION
 * time, so repo `20260904120000_lessons.sql` is remote version `20260904063154`.
 * A version diff would report all three MCP-applied migrations as missing.
 */
export function compareMigrations(filenames, remoteRows) {
  const local = localNamesFrom(filenames);

  // Every guard below exists so the check cannot pass vacuously. An empty
  // result set and a clean bill of health print identically otherwise.
  if (local.length === 0) return fail('no migration files found in the repo');

  const unparsable = local.filter((m) => m.name === null);
  if (unparsable.length > 0) {
    return fail(`migration filenames could not be parsed: ${unparsable.map((m) => m.file).join(', ')}`);
  }

  const dupes = local.map((m) => m.name).filter((n, i, all) => all.indexOf(n) !== i);
  if (dupes.length > 0) {
    return fail(`duplicate migration names in the repo: ${[...new Set(dupes)].join(', ')}`);
  }

  if (!Array.isArray(remoteRows) || remoteRows.length === 0) {
    return fail('the project reported no applied migrations at all — treating as unknown, not as up to date');
  }

  const named = remoteRows.filter((r) => typeof r?.name === 'string' && r.name.length > 0);
  if (named.length !== remoteRows.length) {
    return fail(
      `the API returned ${remoteRows.length - named.length} applied migration(s) with no name; ` +
        'refusing to fall back to version matching, which this project’s versions do not support'
    );
  }

  const remoteNames = new Set(named.map((r) => r.name));
  const localNames = new Set(local.map((m) => m.name));

  // Repo order, oldest first — that is the order they must be applied in.
  const unapplied = [...local]
    .sort((a, b) => a.version.localeCompare(b.version))
    .filter((m) => !remoteNames.has(m.name));

  const untracked = named.filter((r) => !localNames.has(r.name));

  return {
    ok: unapplied.length === 0,
    unapplied,
    untracked,
    matchedBy: 'name',
    localCount: local.length,
    remoteCount: named.length,
  };
}
