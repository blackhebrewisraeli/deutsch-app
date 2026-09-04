// A calendar-real YYYY-MM-DD. The regex alone is not enough: it accepts
// 2026-02-30 and 2026-13-45, which Postgres then rejects, turning a caller's
// bad input into a 500 the API contract promises as a 400. The round-trip
// through Date is what rejects a well-formed but nonexistent day — an invalid
// date normalises to a different one (2026-02-30 becomes 2026-03-02), so it
// cannot survive being formatted back.
const SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(value) {
  if (typeof value !== 'string' || !SHAPE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}
