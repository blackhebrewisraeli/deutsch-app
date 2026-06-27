// Time remaining in the current league week. A league's period_start is the
// Monday (UTC) it began; settlement runs at the next Monday 00:00 UTC, i.e.
// period_start + 7 days. Pure — pass `now` for testing.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
