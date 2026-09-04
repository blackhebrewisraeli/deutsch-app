#!/usr/bin/env node
// Seed the content lane's `lessons` table from fixture.json.
//
// Seeding is a script using the service role, the way lexicon import is a
// script — spec §6.1: "Not in v1: POST/PATCH/DELETE lesson routes."
//
// PAYLOAD SHAPES follow the SHIPPED renderers in src/components/exercises,
// which diverge from the spec §5.3 sketch in two places:
//   - multiple-choice reads `question`/`prompt` plus `choices` as plain
//     STRINGS. It has no `correctId` — the stub is presentation-only.
//   - chat reads `initialMessage`/`persona`, not `{ scenarioId, taskId }`.
// scripts/seed-lessons/fixture.test.jsx renders every fixture exercise and
// fails on either shape, so this cannot drift back to the prose silently.
//
// USAGE — the target is passed at invocation, never read from a committed
// .env. Repo policy (.env.example) is that a cloud service-role key must never
// sit in a local .env: service_role bypasses RLS entirely.
//
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
//   npm run seed:lessons
//
// Add --dry-run to print what would be written and touch nothing.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// The production project ref. Not a secret — it is the host in the public
// VITE_SUPABASE_URL that ships in the browser bundle. It is here as a
// TRIPWIRE: `npm run seed:lessons` pointed at production by muscle memory is
// exactly the accident this guard exists to prevent.
const PRODUCTION_REF = 'xcnnlczvxmuwcqwychox';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const allowProduction = args.has('--allow-production');

function die(message) {
  console.error(`seed-lessons: ${message}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) die('SUPABASE_URL is not set.');
if (!key) die('SUPABASE_SERVICE_ROLE_KEY is not set.');

if (url.includes(PRODUCTION_REF) && !allowProduction) {
  die(
    `refusing to seed PRODUCTION (${PRODUCTION_REF}).\n` +
      '  Seed a branch or the preview project first, verify it renders, and only\n' +
      '  then re-run with --allow-production.'
  );
}

const { lessons } = JSON.parse(readFileSync(join(HERE, 'fixture.json'), 'utf8'));

const rows = lessons.map(({ pack_id, course_code, level, tab, unit_number, exercises }) => ({
  pack_id,
  course_code,
  level,
  tab,
  unit_number,
  exercises,
  // Writer-set, matching the B1/B2 last-write-wins rule: no trigger anywhere in
  // this schema maintains updated_at.
  updated_at: new Date().toISOString(),
}));

console.log(
  `seed-lessons: ${rows.length} units / ${rows.reduce((n, r) => n + r.exercises.length, 0)} exercises` +
    ` → ${url}${dryRun ? ' (dry run)' : ''}`
);
for (const r of rows) console.log(`  ${r.level}/${r.tab} unit ${r.unit_number}: ${r.exercises.length}`);

if (dryRun) process.exit(0);

const db = createClient(url, key, { auth: { persistSession: false } });

// Upsert on the table's UNIQUE key so re-running is idempotent — a seed you can
// only run once is a seed you cannot fix.
const { error } = await db
  .from('lessons')
  .upsert(rows, { onConflict: 'pack_id,course_code,level,tab,unit_number' });

if (error) die(`insert failed: ${error.message}`);

// Read back rather than trusting the write. A silent RLS/grant problem returns
// no error on some paths, and "seeded 4" with 0 rows present is the failure
// mode that would send someone debugging the React client instead.
const { data, error: readError } = await db
  .from('lessons')
  .select('level, tab, unit_number, exercises')
  .eq('course_code', 'de');

if (readError) die(`verification read failed: ${readError.message}`);

const served = data.reduce((n, r) => n + (Array.isArray(r.exercises) ? r.exercises.length : 0), 0);
console.log(`seed-lessons: verified ${data.length} units / ${served} exercises in the table`);
if (data.length !== rows.length) {
  die(`expected ${rows.length} units after seeding, found ${data.length}`);
}
