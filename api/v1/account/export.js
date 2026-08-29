import { createAccountHandler } from '../../_lib/accountHandler.js';

// Full data export. Shares the account lane's guards with delete: this endpoint
// returns the caller's entire dataset in one response, so an unlimited version
// is a bulk-read primitive for anyone holding a token.
//
// Deliberately NOT re-auth gated (§11 Q3, resolved 2026-08-30): export is
// non-destructive, the data is the caller's own, and the lane's rate limits
// already bound bulk pulls.

/**
 * Which user-owned tables the payload covers, and what each is called in it.
 *
 * Declared rather than inlined so export.test.js can assert this set against
 * the full list of user-owned tables. Before that guard existed, `decks` was
 * missing for two months: the cascade deleted it on account deletion while the
 * export quietly left it out, so "export my data" returned less than the
 * account actually held and nothing failed.
 */
export const EXPORTED_TABLES = {
  srs_state: 'srs',
  stats_daily: 'daily',
  decks: 'decks',
  settings: 'settings',
};

/**
 * User-owned tables kept OUT of the payload, each for a stated reason. A table
 * appears here or in EXPORTED_TABLES — never in neither, which is how `decks`
 * went missing.
 */
export const EXCLUDED_TABLES = {
  // Identity the learner already sees and edits in Settings. Including it is
  // defensible and cheap; it is a payload-shape decision rather than a bug fix,
  // so it stays out until asked for.
  profiles: 'editable in Settings; pending a payload-shape decision',
  // Shared competition scaffolding rather than private learning data, and the
  // standings are already visible in the app.
  league_members: 'public competition data; pending a payload-shape decision',
};

// `settings` is one row per user; everything else is a collection. Keeping the
// singular shape avoids changing what existing consumers already parse.
const SINGLE_ROW = new Set(['settings']);

export default createAccountHandler({
  method: 'GET',
  ipRate: { windowMs: 60 * 60 * 1000, max: 20 },
  userRate: { windowMs: 60 * 60 * 1000, max: 10 },
  name: 'account.export',
  failureMessage: 'Failed to export data.',
  run: async ({ res, auth, db }) => {
    const tables = Object.keys(EXPORTED_TABLES);

    const results = await Promise.all(
      tables.map((table) => db.from(table).select('*').eq('user_id', auth.userId))
    );

    const data = {};
    results.forEach((result, index) => {
      if (result.error) throw result.error;
      const table = tables[index];
      const key = EXPORTED_TABLES[table];
      data[key] = SINGLE_ROW.has(table) ? (result.data?.[0] ?? null) : (result.data ?? []);
    });

    res.setHeader('Content-Disposition', 'attachment; filename="sprachschule-export.json"');
    return res.status(200).json({
      email: auth.email,
      exportedAt: new Date().toISOString(),
      data,
    });
  },
});
