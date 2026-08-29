import { createAccountHandler } from '../../_lib/accountHandler.js';

// Full data export. Shares the account lane's guards with delete: this endpoint
// returns the caller's entire dataset in one response, so an unlimited version
// is a bulk-read primitive for anyone holding a token.
//
// BUG: `decks` is a user-owned table (custom decks) that the cascade deletes on
// account deletion but this export omits, so "export my data" does not return
// everything the account holds. Matches the B3 design as written, so changing the
// payload shape is a spec decision, not a silent fix — see
// docs/superpowers/specs/2026-06-27-backend-b3-export-delete-design.md.
export default createAccountHandler({
  method: 'GET',
  ipRate: { windowMs: 60 * 60 * 1000, max: 20 },
  userRate: { windowMs: 60 * 60 * 1000, max: 10 },
  name: 'account.export',
  failureMessage: 'Failed to export data.',
  run: async ({ res, auth, db }) => {
    const [srsRes, dailyRes, settingsRes] = await Promise.all([
      db.from('srs_state').select('*').eq('user_id', auth.userId),
      db.from('stats_daily').select('*').eq('user_id', auth.userId),
      db.from('settings').select('*').eq('user_id', auth.userId),
    ]);

    if (srsRes.error) throw srsRes.error;
    if (dailyRes.error) throw dailyRes.error;
    if (settingsRes.error) throw settingsRes.error;

    res.setHeader('Content-Disposition', 'attachment; filename="sprachschule-export.json"');
    return res.status(200).json({
      email: auth.email,
      exportedAt: new Date().toISOString(),
      data: {
        srs: srsRes.data ?? [],
        daily: dailyRes.data ?? [],
        settings: settingsRes.data?.[0] ?? null,
      },
    });
  },
});
