// Time remaining in the current league week. A league's period_start is the
// Monday (UTC) it began; settlement runs at the next Monday 00:00 UTC, i.e.
// period_start + 7 days. Pure — pass `now` for testing.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// The Monday (UTC) the current league week began, as YYYY-MM-DD.
//
// This lives in src/lib rather than api/_lib because BOTH lanes need it: the
// server keys league membership on it (join/settle) and the client needs it to
// ask "is this membership row the CURRENT week's?" — `rank` is null until
// settle, so a live standing has to be matched by period rather than read off
// the row. Same reason zoneCounts is shared: one definition of the league week,
// so the client cannot drift from what settlement actually does.
//
// api/_lib/leagueLogic.js re-exports it for the server callers.
export function currentPeriodStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const delta = dow === 0 ? -6 : 1 - dow; // back to Monday
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function weekRemaining(periodStart, now = new Date()) {
  const endMs = Date.parse(`${periodStart}T00:00:00Z`) + WEEK_MS;
  const ms = endMs - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return { ended: true, label: 'Ending…' };

  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;

  let label;
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${mins}m`;
  else label = `${mins}m`;
  return { ended: false, label };
}
