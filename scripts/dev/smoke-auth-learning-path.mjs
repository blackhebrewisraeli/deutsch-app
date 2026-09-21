#!/usr/bin/env node
/**
 * Browser smoke for the AUTHENTICATED learning path.  ⚠ SCAFFOLD ONLY.
 *
 * Sibling of `smoke-learning-path.mjs`, which walks the same journey as a
 * guest. That one proves local persistence survives a reload. This one is
 * about the half a guest can never reach: the sync lane, leagues, and the
 * account controls.
 *
 * ── Status ───────────────────────────────────────────────────────────────
 * The HARNESS below is real and runs: stub-env build, preview server,
 * Chromium launch, a seeded signed-in session, and the viewport loop.
 * The six SMOKE STEPS are `// TODO` stubs. Running this today exits 2 and
 * prints what is unimplemented — deliberately NOT 0, so it cannot be wired
 * into CI and sit there reporting green on an empty walk.
 *
 * ── What it will prove, once the steps are filled in ──────────────────────
 *   1. A stub session restores without secrets (no real token, no network).
 *   2. Finishing an exercise fires the expected sync write.
 *   3. A reload keeps that progress — server state, not just localStorage.
 *   4. Leagues opens and renders a standings table, not the error line.
 *   5. Account controls are present and sign-out returns to the guest shell.
 *   6. None of the above overflows at 1280 / 375 / 320.
 *
 * ── Why this builds its own target (do not "simplify" this away) ──────────
 * The signed-in pass seeds a Supabase session into localStorage. A build
 * carrying a developer's REAL VITE_SUPABASE_* REJECTS that seed, and the run
 * dies with "the session seed no longer satisfies useAuth" on a developer box
 * while passing in CI. So with no AUDIT_BASE we build with STUB Supabase
 * config into a scratch dir. Same lesson audit-contrast.mjs documents at
 * length; see its header before changing this.
 *
 * Nothing here is a credential. `isAuthConfigured()` only checks both values
 * are truthy, and every outbound call is intercepted.
 *
 * Usage:
 *   npm run smoke:auth-learning-path                    # builds and serves itself
 *   AUDIT_BASE=http://localhost:5290 node scripts/dev/smoke-auth-learning-path.mjs
 *   AUDIT_SKIP_BUILD=1 npm run smoke:auth-learning-path # reuse dist-smoke-auth/
 *
 * Same AUDIT_BASE / AUDIT_SKIP_BUILD / AUDIT_PORT contract as
 * smoke-learning-path.mjs and audit-contrast.mjs.
 *
 * Exit 0 on a clean walk of all three viewports; 1 on failure; 2 while the
 * steps are still scaffolded.
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECK_ID, STATE_KEY, learningPathSeed, srsKey } from './learning-path-seed.js';

// Absolute path to the pinned vite binary rather than bare `npx vite`: npx is
// resolved through PATH and will fetch-and-execute an uninstalled name from
// the registry, so a shadowed PATH entry becomes arbitrary code mid-build
// (Sonar S4036). Derived from this file's location, not process.cwd(), so the
// script behaves the same however it is invoked.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VITE_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'vite');

// Stub Supabase config, NOT credentials. See the header note.
const STUB_ENV = {
  VITE_SUPABASE_URL: 'https://stub.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'stub-anon-key-not-a-secret',
  VITE_LEAGUES_ENABLED: 'true',
};

// Its own scratch dir and port, so this never clobbers `dist/`, `dist-smoke/`
// (the guest smoke) or `dist-audit/` (the contrast audit), and never collides
// with one of them already being served.
const OUT_DIR = 'dist-smoke-auth';
const SMOKE_PORT = Number(process.env.AUDIT_PORT ?? 5295);
const EXPLICIT_BASE = process.env.AUDIT_BASE;
const BASE = EXPLICIT_BASE ?? `http://localhost:${SMOKE_PORT}`;

// 375 is the iPhone-class width the brief names. The contrast audit uses 390;
// both are worth having — 375 is the tighter of the two and 320 is the floor
// where the header budget is only ~10px.
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 375, height: 800 },
  { name: 'narrow', width: 320, height: 800 },
];

// VocabTab's click-lock swallows the next choice for 200ms after a verdict.
const CLICK_LOCK_MS = 250;

// supabase-js stores its session under `sb-<project-ref>-auth-token`, where
// the ref is the first label of the API host. Derived, not hardcoded, so this
// works against the stub build and against a developer box pointed at the
// real project.
const SUPABASE_REF = (process.env.VITE_SUPABASE_URL ?? STUB_ENV.VITE_SUPABASE_URL)
  .replace(/^https?:\/\//, '')
  .split('.')[0];
const SESSION_KEY = `sb-${SUPABASE_REF}-auth-token`;

let previewServer = null;

function stopPreview() {
  if (previewServer && !previewServer.killed) previewServer.kill('SIGTERM');
  previewServer = null;
}
process.on('exit', stopPreview);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopPreview();
    process.exit(130);
  });
}

function run(cmd, args, env = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
    );
  });
}

async function waitForServer(url, seconds = 60) {
  for (let i = 0; i < seconds; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return i;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return -1;
}

function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(full) : statSync(full).mtimeMs);
  }
  return newest;
}

/** Build with STUB env + serve, unless the caller says they own the server. */
async function provisionTarget() {
  if (process.env.AUDIT_SKIP_BUILD === '1') {
    const built = `${OUT_DIR}/index.html`;
    if (!existsSync(built)) {
      throw new Error(
        `AUDIT_SKIP_BUILD=1 but ${OUT_DIR}/ has no build to reuse. Run once without it.`
      );
    }
    console.log(`Reusing the existing ${OUT_DIR}/ build (AUDIT_SKIP_BUILD=1).`);
    const srcMs = newestMtime('src');
    const builtMs = statSync(built).mtimeMs;
    if (srcMs > builtMs) {
      const mins = Math.round((srcMs - builtMs) / 60000);
      console.log(
        `⚠ src/ is ${mins} minute(s) NEWER than ${OUT_DIR}/ — you are smoking a stale ` +
          'build. Drop AUDIT_SKIP_BUILD to rebuild.'
      );
    }
  } else {
    console.log(`Building with stub Supabase config → ${OUT_DIR}/`);
    await run(VITE_BIN, ['build', '--outDir', OUT_DIR], STUB_ENV);
  }

  console.log(`Serving ${OUT_DIR}/ on :${SMOKE_PORT}`);
  previewServer = spawn(
    VITE_BIN,
    ['preview', '--outDir', OUT_DIR, '--port', String(SMOKE_PORT), '--strictPort'],
    { stdio: 'ignore' }
  );
  previewServer.on('error', (err) => {
    console.error(`preview server failed to start: ${err.message}`);
  });

  const waited = await waitForServer(BASE);
  if (waited < 0) {
    throw new Error(
      `preview never answered on ${BASE}. If something else holds :${SMOKE_PORT}, ` +
        'set AUDIT_PORT, or set AUDIT_BASE to smoke a server you are running yourself.'
    );
  }
  console.log(`preview up after ${waited}s`);
}

/**
 * A well-formed stub session — no credentials, nothing real to leak.
 *
 * `useAuth` takes its status from `client.auth.getSession()`, which
 * supabase-js resolves out of storage with no network round-trip so long as
 * the session has not expired. Only `getUser()` round-trips. So this is
 * enough to render the whole signed-in shell.
 *
 * `expires_at` sits comfortably ahead of the run so supabase-js never tries
 * to refresh mid-walk.
 */
function seedSignedInSession(key) {
  localStorage.setItem(
    key,
    JSON.stringify({
      access_token: 'smoke.stub.token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'smoke-stub-refresh',
      user: {
        id: '00000000-0000-4000-8000-000000000002',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'smoke@example.test',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00.000Z',
      },
    })
  );
}

/**
 * Baseline LOCAL state, installed before first paint.
 *
 * Not the session — step 1 adds that on top. This is only the guest-side
 * blob the guest smoke also seeds (level, tutorial flag, deck progress).
 * Without `deutsch-level` the build lands on the placement test ("Find your
 * level") and never reaches the shell at all.
 *
 * `addInitScript`, not goto → evaluate → reload: the guest smoke lost that
 * race on CI, where App's persist effect reads empty state and then writes
 * `{ ...current, learnedWords: {} }` over the seed. Init scripts run before
 * page JS.
 *
 * sessionStorage marks the seed applied so a later reload keeps what the
 * learner just did instead of resetting to the seed.
 */
async function installBaselineSeed(context, seed) {
  await context.addInitScript((entries) => {
    try {
      if (sessionStorage.getItem('__smoke_auth_learning_path_seeded') === '1') return;
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, value);
      }
      sessionStorage.setItem('__smoke_auth_learning_path_seeded', '1');
    } catch {
      // private mode — dismissEntryScreens fails loudly if the shell never appears
    }
  }, seed.localStorage);
}

/**
 * Entry gate + tutorial.
 *
 * The guest gate renders only when the BUILD has VITE_SUPABASE_* — which this
 * one always does, unlike the guest smoke's build, so this is NOT a no-op
 * here. The tutorial scrim is the other trap: it eats every click, and
 * writing `deutsch-tutorial-completed` does NOT dismiss it. Click
 * "Skip tutorial".
 */
async function dismissEntryScreens(page) {
  const gate = await page.$('[data-entry="guest"]');
  if (gate) {
    await gate.click();
    await page.waitForTimeout(200);
  }
  const skip = page.getByRole('button', { name: /skip tutorial/i });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(200);
  }
  const onShell = await page.evaluate(() => Boolean(document.querySelector('header')));
  if (!onShell) {
    throw new Error(
      'smoke-auth-learning-path: never reached the app shell — the entry flow changed.'
    );
  }
}

function horizontalOverflow() {
  return document.documentElement.scrollWidth - document.documentElement.clientWidth;
}

/**
 * `window.innerWidth` GROWS with the overflow, so it cannot detect one.
 * Measure `scrollWidth - clientWidth` on the documentElement instead.
 */
async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(horizontalOverflow);
  if (overflow > 1) {
    throw new Error(
      `smoke-auth-learning-path: horizontal overflow ${overflow}px at ${label} ` +
        `(viewport ${page.viewportSize().width}px)`
    );
  }
}

async function dumpPage(page, label) {
  try {
    const url = page.url();
    const text = (await page.evaluate(() => (document.body?.innerText || '').slice(0, 800))).replace(
      /\s+/g,
      ' '
    );
    console.error(`smoke-auth-learning-path dump (${label}) ${url}: ${text}`);
  } catch (err) {
    console.error(`smoke-auth-learning-path dump (${label}) failed: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SMOKE STEPS — all six are unimplemented. See the note at the top of the
// file before filling any of them in.
// ─────────────────────────────────────────────────────────────────────────

/** Anything this run could not yet prove. Non-empty ⇒ exit 2. */
const unimplemented = [];
function todo(step, what) {
  unimplemented.push(`${step}: ${what}`);
}

/**
 * STEP 1 — Mock session restoration, without secrets.
 *
 * TODO: Seed the session with `seedSignedInSession` BEFORE first paint, the
 *       way `installBaselineSeed` already seeds the local blob — via
 *       `context.addInitScript`, not goto→evaluate→reload. The guest smoke
 *       lost that race on CI, where App's persist effect reads empty state
 *       and then clobbers the seed. Init scripts run before page JS.
 *       Until this lands the walk runs as a GUEST, so every signed-in
 *       assertion below would be measuring the wrong shell.
 * TODO: Reload, then assert the app is actually in the signed-in state —
 *       AccountChip present, not merely "a header exists". A header renders
 *       for a guest too, so a header check passes on a failed restore.
 * TODO: Assert no real credential is anywhere in the run: no value from a
 *       developer `.env`, no token matching a real project ref. This guards
 *       against someone "fixing" a flake by pointing the smoke at prod.
 * TODO: Fail loudly with the audit-contrast wording if useAuth rejects the
 *       seed — "the session seed no longer satisfies useAuth" — and name
 *       SESSION_KEY + expires_at, the two things that actually break it.
 */
async function stepRestoreSession(context, page, seed) {
  void context;
  void page;
  void seed;
  todo('step 1', 'session restoration is not seeded or asserted yet');
}

/**
 * STEP 2 — Complete an exercise and check the sync request.
 *
 * TODO: Walk the deck the way `practiceUntilComplete` does in the guest
 *       smoke (choose → GOOD → wait out CLICK_LOCK_MS), to DeckCompleteBanner.
 * TODO: Record outbound calls with `page.on('request')` BEFORE the first
 *       answer, so the assertion sees the whole exercise, not the tail.
 * TODO: Assert the progress write actually went out — the apply-progress
 *       call, with the expected deck/card payload. "No error appeared" is
 *       not evidence a request was made; a dead sync lane is silent.
 * TODO: Assert the idempotency key is present AND round-trips. It has been
 *       dropped three separate ways in this codebase (not serialised by the
 *       adapter, clobbered by the merge, never pushed by the hook), and each
 *       one alone re-awards on every load.
 * TODO: Stub the response rather than letting it 503 like the guest smoke
 *       does — step 3 needs a server state to come back to.
 */
async function stepCompleteExerciseAndSync(page, seed) {
  void page;
  void seed;
  todo('step 2', 'exercise walk + sync-request assertion not written');
}

/**
 * STEP 3 — Refresh and verify progress persistence.
 *
 * TODO: Reload, re-dismiss the entry screens, and assert progress survived.
 * TODO: Assert it survived from the SERVER, not just localStorage. Reuse
 *       `assertPersistedProgress`-style checks for the local half, but this
 *       step is only meaningful if the reconcile is what restores it — clear
 *       the local blob and let the (stubbed) server response repopulate it.
 * TODO: Wait on `syncStatus.settled`, never `lastSyncedAt`. A FAILED
 *       reconcile also settles, and any load-time decision that reads
 *       "absence" out of local state before settle is the bug class that
 *       produced #298, #299/#300 and #303.
 * TODO: Assert no duplicate award: XP/streak/achievements must be identical
 *       before and after the refresh.
 */
async function stepRefreshAndVerifyPersistence(page, seed) {
  void page;
  void seed;
  todo('step 3', 'post-refresh persistence + settle-gating not written');
}

/**
 * STEP 4 — Open leagues and check the table.
 *
 * TODO: Navigate Stats → Ligen (leagues need VITE_LEAGUES_ENABLED, already
 *       set in STUB_ENV).
 * TODO: Stub join / standings / profile with a POPULATED fixture. Without
 *       one the surface renders "Couldn't load your league." — a single
 *       error line, which is exactly the state that hides every row the
 *       table is supposed to show. A fixture that cannot express the
 *       failure cannot catch it.
 * TODO: Assert real rows: rank order, the current user highlighted, the
 *       promote/demote zones. Not just "the heading is present".
 * TODO: Assert the rows are keyboard-reachable. 14 league rows once shipped
 *       as `<li onClick>` — dead to Tab — with 1600 tests green.
 * TODO: Assert the winner bonus is NOT re-claimed on this load (see #303).
 */
async function stepOpenLeagues(page) {
  void page;
  todo('step 4', 'leagues navigation + standings-table assertions not written');
}

/**
 * STEP 5 — Account controls and logout.
 *
 * TODO: Open AccountChip; assert the sheet CONTENTS, not just its trigger —
 *       the email line, export, delete, and the red Sign out.
 * TODO: Assert the account controls are reachable at every viewport; the
 *       320px header budget is ~10px and this is where it breaks.
 * TODO: Click Sign out and assert the app returns to the guest shell and the
 *       session key is gone from localStorage.
 * TODO: Do NOT exercise delete-account. It is destructive and there is no
 *       safe stub for it here; assert the control exists and stop.
 */
async function stepAccountControlsAndLogout(page) {
  void page;
  todo('step 5', 'account-sheet contents + sign-out assertions not written');
}

/**
 * STEP 6 — Viewport responsive checks at 1280 / 375 / 320.
 *
 * Partly live already: `assertNoOverflow` runs at each labelled surface
 * below, and the VIEWPORTS loop in `main` drives all three widths.
 *
 * TODO: Add the per-child edge check. `minWidth: 0` on flex children means
 *       an overflow renders as text-on-text and NEVER widens the container,
 *       so no scrollWidth assertion can see it. Compare each child's right
 *       edge against its own parent's.
 * TODO: Assert the nav goes icon-only when labels stop fitting, rather than
 *       letting labels clip.
 * TODO: Capture a screenshot per viewport on failure, so a CI red says which
 *       width broke without a rerun.
 */
async function stepViewportChecks(page, label) {
  await assertNoOverflow(page, label);
  todo('step 6', 'per-child edge checks + nav collapse assertions not written');
}

/** One full signed-in walk at one viewport. */
async function walkViewport(context, page, vp, seed) {
  const label = `${vp.name}@${vp.width}`;
  console.log(`→ ${label}`);
  await page.setViewportSize({ width: vp.width, height: vp.height });

  // TODO: route interception for /api, /auth/v1, /rest/v1 goes here — but
  // unlike the guest smoke it must ANSWER rather than 503, because steps 2-4
  // assert on what comes back. Keep it closed to the real network.

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  await stepRestoreSession(context, page, seed);
  await dismissEntryScreens(page);
  await stepViewportChecks(page, `${label} home`);

  await stepCompleteExerciseAndSync(page, seed);
  await stepRefreshAndVerifyPersistence(page, seed);
  await stepOpenLeagues(page);
  await stepAccountControlsAndLogout(page);

  console.log(`✓ ${label} (harness only — steps are scaffolded)`);
}

async function launchBrowser() {
  const args = ['--disable-dev-shm-usage'];
  try {
    return await chromium.launch({ headless: true, args });
  } catch (err) {
    const missing = /Executable doesn't exist|Failed to launch/i.test(String(err?.message ?? err));
    if (!missing) throw err;
    // CI installs Playwright's Chromium. A developer box (and the cloud VM)
    // may only have system Chrome; channel:'chrome' uses that instead of
    // failing a download from cdn.playwright.dev.
    console.log('Playwright Chromium not installed; falling back to system Chrome');
    return await chromium.launch({ headless: true, channel: 'chrome', args });
  }
}

async function main() {
  if (EXPLICIT_BASE) console.log(`Smoking the server at ${BASE} (AUDIT_BASE set).`);
  else await provisionTarget();

  const seed = learningPathSeed();
  console.log(
    `Seed: ${seed.learnedCards.length}/${seed.cards.length} of ${DECK_ID} learned, ` +
      `${seed.remainingCount} left; session key ${SESSION_KEY}`
  );

  const browser = await launchBrowser();
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext();
      await installBaselineSeed(context, seed);
      const page = await context.newPage();
      try {
        await walkViewport(context, page, vp, seed);
      } catch (err) {
        await dumpPage(page, `${vp.name}@${vp.width}`);
        throw err;
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  if (unimplemented.length) {
    // Exit 2, never 0. An empty walk that exits 0 is indistinguishable from a
    // passing one, and this repo has already shipped probes that went green on
    // broken code. De-duplicated: the same TODO fires once per viewport.
    console.error('\nsmoke-auth-learning-path: SCAFFOLD — not a passing run.');
    for (const line of [...new Set(unimplemented)]) console.error(`  • ${line}`);
    console.error(`\n${new Set(unimplemented).size} step(s) still to implement.`);
    process.exit(2);
  }

  console.log(
    `✓ authenticated learning path clean on ${VIEWPORTS.map((v) => `${v.name}@${v.width}`).join(', ')}`
  );
  // The preview child keeps the event loop alive otherwise, so a clean walk
  // would hang until the job times out.
  process.exit(0);
}

main().catch((err) => {
  const message = err?.message || String(err);
  if (!message.startsWith('smoke-auth-learning-path:')) {
    console.error(`smoke-auth-learning-path: ${message}`);
  }
  console.error(err);
  process.exit(1);
});
