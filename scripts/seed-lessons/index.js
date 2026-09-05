#!/usr/bin/env node
// Seed the content lane's `lessons` table from the curated German pack.
//
// Seeding is a script using the service role, the way lexicon import is a
// script — spec §6.1: "Not in v1: POST/PATCH/DELETE lesson routes."
//
// PAYLOAD SHAPES follow the SHIPPED renderers in src/components/exercises.
// build.js maps pack modules onto those keys; validate.js fails the run
// if a payload would render an empty card or be dropped by sanitizeLessons.
//
// USAGE — the target is passed at invocation, never read from a committed
// .env. Repo policy (.env.example) is that a cloud service-role key must never
// sit in a local .env: service_role bypasses RLS entirely.
//
//   npm run seed:lessons -- --dry-run
//     Build + validate only. No database, no service-role key required.
//
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
//   npm run seed:lessons
//
// Add --allow-production to write the hosted project. Re-runs upsert, then
// delete leftover course_code='de' rows the build no longer emits.

import { createClient } from '@supabase/supabase-js';
import { buildLessons } from './build.js';
import { findOrphans, validateLessons } from './validate.js';

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

const lessons = buildLessons();
const check = validateLessons(lessons);
if (!check.ok) {
  die(`validation failed:\n  ${check.errors.join('\n  ')}`);
}

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

const exerciseCount = rows.reduce((n, r) => n + r.exercises.length, 0);
console.log(
  `seed-lessons: ${rows.length} units / ${exerciseCount} exercises` +
    `${dryRun ? ' (dry run)' : ''}`
);
for (const r of rows) {
  console.log(`  ${r.level}/${r.tab} unit ${r.unit_number}: ${r.exercises.length}`);
}

if (dryRun) process.exit(0);

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

const db = createClient(url, key, { auth: { persistSession: false } });

// Upsert on the table's UNIQUE key so re-running is idempotent — a seed you can
// only run once is a seed you cannot fix.
const { error } = await db
  .from('lessons')
  .upsert(rows, { onConflict: 'pack_id,course_code,level,tab,unit_number' });

if (error) die(`insert failed: ${error.message}`);

// Read back rather than trusting the write. A silent RLS/grant problem returns
// no error on some paths, and "seeded N" with 0 rows present is the failure
// mode that would send someone debugging the React client instead.
const { data, error: readError } = await db
  .from('lessons')
  .select('id, pack_id, course_code, level, tab, unit_number, exercises')
  .eq('course_code', 'de');

if (readError) die(`verification read failed: ${readError.message}`);

const orphans = findOrphans(data, rows);
if (orphans.length > 0) {
  const ids = orphans.map((row) => row.id).filter(Boolean);
  if (ids.length !== orphans.length) {
    die(`orphan delete aborted: ${orphans.length - ids.length} leftover row(s) have no id`);
  }
  const { error: deleteError } = await db.from('lessons').delete().in('id', ids);
  if (deleteError) die(`orphan delete failed: ${deleteError.message}`);
  console.log(`seed-lessons: deleted ${orphans.length} leftover unit(s)`);
}

const { data: after, error: afterError } = await db
  .from('lessons')
  .select('level, tab, unit_number, exercises')
  .eq('course_code', 'de');

if (afterError) die(`verification read failed: ${afterError.message}`);

const served = after.reduce((n, r) => n + (Array.isArray(r.exercises) ? r.exercises.length : 0), 0);
console.log(`seed-lessons: verified ${after.length} units / ${served} exercises in the table`);
if (after.length !== rows.length) {
  die(`expected ${rows.length} units after seeding, found ${after.length}`);
}
