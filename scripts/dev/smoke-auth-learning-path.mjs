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

// src/lib/progressQueue.js owns this key; the queue is the only place the
// id a given answer enqueued is observable from outside the bundle.
const QUEUE_KEY = 'deutsch-app-progress-queue-v1';

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
 *
 * A plain factory rather than a page function: it is serialised into the init
 * script, and `EXPECTED_BEARER` below reads the same object, so the token the
 * app presents and the token step 2 asserts on can never drift apart.
 */
function stubSession() {
  return {
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
  };
}

/** The bearer the flush must present. Derived, so the two cannot drift. */
const EXPECTED_BEARER = `Bearer ${stubSession().access_token}`;

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
 * The SESSION, installed before first paint — step 1's half of the seed.
 *
 * Separate from `installBaselineSeed` on purpose: that one is the guest-side
 * blob the guest smoke also writes, this one is what makes the run signed in.
 * Keeping them apart means a failure says which half did not take.
 *
 * Same `addInitScript` reasoning: `useAuth` reads
 * `client.auth.getSession()` during mount, so a session written after the
 * first paint leaves the app rendered as a guest and every signed-in
 * assertion below measures the wrong shell.
 */
async function installSignedInSeed(context, key) {
  await context.addInitScript(
    ({ storageKey, session }) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(session));
      } catch {
        // private mode — stepRestoreSession fails loudly on the guest shell
      }
    },
    { storageKey: key, session: stubSession() }
  );
}

/**
 * Refuse to run against anything real.
 *
 * The seeded token is a fake string, not a signed JWT, and the build is made
 * with a stub host. This asserts both, so that "fixing" a flake by pointing
 * the smoke at a real project fails here instead of quietly sending a walk of
 * synthetic progress at production.
 *
 * Skipped only when the caller set AUDIT_BASE, which means they are supplying
 * the server and own that decision.
 */
function assertNoRealCredentials() {
  if (EXPLICIT_BASE) {
    console.log('AUDIT_BASE set — skipping the stub-host guard; you own that server.');
    return;
  }
  const { access_token: token } = stubSession();
  // A real Supabase access token is a JWT: three base64url segments, first
  // decoding to a JSON header. Ours must not look like one.
  if (token.split('.').length === 3 && /^eyJ/.test(token)) {
    throw new Error('smoke-auth-learning-path: the seeded token looks like a real JWT.');
  }
  if (SUPABASE_REF !== 'stub') {
    throw new Error(
      `smoke-auth-learning-path: built against project ref "${SUPABASE_REF}", not the stub. ` +
        'This smoke must never run against a real project.'
    );
  }
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
 * STEP 1 — Mock session restoration, without secrets.  ✅ IMPLEMENTED
 *
 * The seed itself is installed in `main` via `installSignedInSeed`, before
 * the context's first page exists — see that function for why it cannot be
 * done here with `evaluate`.
 *
 * What this asserts is that the app ACCEPTED it. "A header exists" is not
 * that test: the header renders for a guest too, and an earlier draft of
 * this file passed on the guest shell for exactly that reason. AccountChip
 * is the discriminator — signed out it renders a "Sign in" button, signed in
 * it renders a `aria-label="Account"` avatar button with the email initial.
 * Both directions are asserted, so a chip that renders BOTH (a half-restored
 * session) fails too.
 */
async function stepRestoreSession(context, page, seed) {
  void context;
  void seed;

  const account = page.getByRole('button', { name: 'Account', exact: true });
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true });

  try {
    await account.waitFor({ state: 'visible', timeout: 10000 });
  } catch (err) {
    throw new Error(
      'smoke-auth-learning-path: signed-in pass never reached the account chrome. ' +
        'The session seed no longer satisfies useAuth — check SESSION_KEY ' +
        `(${SESSION_KEY}) and expires_at. (${err.message})`
    );
  }

  if (await signIn.isVisible().catch(() => false)) {
    throw new Error(
      'smoke-auth-learning-path: "Sign in" is showing alongside the account chip — ' +
        'the session restored only partially.'
    );
  }

  // The seed is a fake string, not a credential, and it must stay that way.
  const seeded = await page.evaluate((key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }, SESSION_KEY);
  if (!seeded || seeded.access_token !== stubSession().access_token) {
    throw new Error(
      'smoke-auth-learning-path: the stored session is not the stub one this run seeded.'
    );
  }
}

/**
 * Capture the progress-sync lane.
 *
 * Registered BEFORE the catch-all so it wins: Playwright matches the most
 * recently registered handler first.
 *
 * It ANSWERS 200 rather than 503 like the guest smoke does. A 503 leaves the
 * event at the head of the queue and `flushQueue` returns, so the queue never
 * drains and the round-trip half of the assertion could not be made.
 */
async function captureProgressSync(page) {
  const posts = [];
  await page.route('**/api/v1/progress/events', async (route) => {
    const req = route.request();
    let body = null;
    try {
      body = JSON.parse(req.postData() ?? 'null');
    } catch {
      body = { __unparseable: req.postData() };
    }
    posts.push({ method: req.method(), auth: req.headers().authorization ?? null, body });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  return posts;
}

/** The card currently on screen, matched by headword. */
async function visibleCard(page, cards) {
  return page.evaluate((payload) => {
    const text = document.body.innerText || '';
    return payload.find((card) => text.includes(card.de)) ?? null;
  }, cards);
}

/**
 * The id `recordEvent` just enqueued.
 *
 * `enqueue` APPENDS, so immediately after a verdict the tail of the queue is
 * that answer's event. Read straight after the click: the flush is debounced
 * 500ms behind `deutsch:progress`, so the row is still there.
 *
 * This is what makes step 2 specific. Counting POSTs cannot work — see the
 * backlog note on `stepCompleteExerciseAndSync`.
 */
async function queueTailId(page) {
  return page.evaluate((key) => {
    try {
      const q = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(q) && q.length ? (q[q.length - 1]?.id ?? null) : null;
    } catch {
      return null;
    }
  }, QUEUE_KEY);
}

/**
 * Answer through the queue until DeckCompleteBanner. Ported from the guest
 * smoke, plus the per-answer id capture.
 *
 * @returns {Promise<string[]>} the id enqueued by each answer, in order.
 */
async function practiceUntilComplete(page, seed) {
  const empty = page.getByText('Select a deck to start.');
  const complete = page.getByText(/Deck complete/);
  await page.waitForFunction(
    (des) => des.some((de) => (document.body.innerText || '').includes(de)),
    seed.cards.map((card) => card.de),
    { timeout: 10000 }
  );
  const budget = seed.cards.length + 2;
  const enqueued = [];

  for (let i = 0; i < budget; i += 1) {
    if (await complete.isVisible().catch(() => false)) return enqueued;
    if (await empty.isVisible().catch(() => false)) {
      throw new Error(
        'smoke-auth-learning-path: empty "Select a deck to start." state after a card'
      );
    }

    const card = await visibleCard(page, seed.cards);
    if (!card) {
      throw new Error(
        `smoke-auth-learning-path: no food-deck headword visible on card ${i + 1}`
      );
    }

    const choice = page.getByRole('button', { name: card.en, exact: true });
    await choice.waitFor({ state: 'visible', timeout: 10000 });
    await choice.click();

    const good = page.getByRole('button', { name: 'GOOD', exact: true });
    await good.waitFor({ state: 'visible', timeout: 10000 });
    await good.click();

    const id = await queueTailId(page);
    if (!id) {
      throw new Error(
        `smoke-auth-learning-path: answering card ${i + 1} enqueued nothing — ` +
          'recordEvent is not reaching the progress queue.'
      );
    }
    if (enqueued.includes(id)) {
      throw new Error(
        `smoke-auth-learning-path: card ${i + 1} reused idempotency id ${id} — ` +
          'newEventId is not producing a fresh key per answer.'
      );
    }
    enqueued.push(id);

    // VocabTab's click-lock swallows the next choice for 200ms after a verdict.
    await page.waitForTimeout(CLICK_LOCK_MS);
  }

  if (!(await complete.isVisible().catch(() => false))) {
    throw new Error('smoke-auth-learning-path: queue emptied without DeckCompleteBanner');
  }
  return enqueued;
}

/** Wait until every id in `wanted` has been seen on the wire. */
async function waitForSyncedIds(page, posts, wanted, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  const seen = () => new Set(posts.map((p) => p.body?.id));
  while (Date.now() < deadline) {
    const have = seen();
    if (wanted.every((id) => have.has(id))) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/** Poll the progress queue to empty. Polled, not read once: a flush cycle is async. */
async function waitForQueueDrained(page, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await page.evaluate((key) => {
      try {
        return JSON.parse(localStorage.getItem(key) || '[]')?.length ?? null;
      } catch {
        return null;
      }
    }, QUEUE_KEY);
    if (last === 0) return 0;
    await page.waitForTimeout(250);
  }
  return last;
}

/**
 * STEP 2 — Complete an exercise and check the sync request.  ✅ IMPLEMENTED
 *
 * The lane: answering dispatches `deutsch:progress` → App schedules a flush
 * (500ms) → `flushQueue` POSTs each queued event to
 * `/api/v1/progress/events` with a bearer token. Note this flush is gated on
 * a JWT, NOT on VITE_SYNC_ENABLED — sync off must not strand answers. That is
 * why step 2 works without the flag and step 3 will need it.
 *
 * ── Why this keys on ids and never on counts ─────────────────────────────
 * A first draft asserted "at least as many POSTs as cards answered" and went
 * green reporting 65 events for 3 cards. Those 62 extras are real:
 * `expandGuestBacklog` diffs local daily counters against what the server
 * has, and our `/rest/v1` stub always answers empty, so the whole local day
 * is re-expanded into catch-up events on EVERY flush. They are synthesised
 * to be indistinguishable from real ones — same tab, same level, same
 * dateKey — so no payload filter can separate them either.
 *
 * That assertion would therefore have passed with per-answer sync entirely
 * dead. The fix is to capture the id each answer actually enqueues (the
 * queue tail, see `queueTailId`) and require THOSE exact ids on the wire.
 * If `recordEvent` stops enqueuing, the capture fails; if the flush stops
 * POSTing, the ids never arrive. Backlog noise cannot satisfy either.
 *
 * Asserted here, rather than "no error appeared" — a dead sync lane is
 * silent, so absence of an error is not evidence a request was made:
 *   - one freshly-enqueued event per answered card, ids distinct;
 *   - every one of those ids reaching /api/v1/progress/events;
 *   - each carrying the stub bearer and a well-formed UUID id;
 *   - the payload matching what the learner did (vocab / a1 / de, today,
 *     a real verdict);
 *   - the queue draining, which is the round-trip half: `flushQueue` only
 *     shifts an event off after a 200.
 */
async function stepCompleteExerciseAndSync(page, seed, posts) {
  const enqueued = await practiceUntilComplete(page, seed);
  if (enqueued.length < 1) {
    throw new Error('smoke-auth-learning-path: the deck was already complete — nothing practised.');
  }

  if (!(await waitForSyncedIds(page, posts, enqueued))) {
    const seen = new Set(posts.map((p) => p.body?.id));
    const missing = enqueued.filter((id) => !seen.has(id));
    throw new Error(
      `smoke-auth-learning-path: ${missing.length} of ${enqueued.length} answered event(s) ` +
        `never reached /api/v1/progress/events (${missing.join(', ')}) — the sync lane is ` +
        `not firing. ${posts.length} POST(s) were seen in total.`
    );
  }

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const today = new Date();
  const dateKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  const byId = new Map();
  for (const post of posts) {
    if (post.body?.id && !byId.has(post.body.id)) byId.set(post.body.id, post);
  }

  for (const id of enqueued) {
    const { method, auth, body } = byId.get(id);
    if (method !== 'POST') {
      throw new Error(`smoke-auth-learning-path: progress event sent as ${method}, not POST.`);
    }
    if (auth !== EXPECTED_BEARER) {
      // Never print the header: say which check failed, not what it held.
      throw new Error(
        'smoke-auth-learning-path: progress POST did not carry the seeded bearer token.'
      );
    }
    if (!UUID.test(body.id)) {
      throw new Error(`smoke-auth-learning-path: idempotency id is not a UUID (${body.id}).`);
    }
    if (body.tab !== 'vocab') {
      throw new Error(`smoke-auth-learning-path: expected tab "vocab", got "${body.tab}".`);
    }
    if (body.level !== 'a1') {
      throw new Error(`smoke-auth-learning-path: expected level "a1", got "${body.level}".`);
    }
    if ((body.packId ?? 'de') !== 'de') {
      throw new Error(`smoke-auth-learning-path: expected packId "de", got "${body.packId}".`);
    }
    if (body.dateKey !== dateKey) {
      throw new Error(
        `smoke-auth-learning-path: dateKey ${body.dateKey} is not today (${dateKey}).`
      );
    }
    if (!['correct', 'almost', 'wrong'].includes(body.verdict)) {
      throw new Error(`smoke-auth-learning-path: unknown verdict "${body.verdict}".`);
    }
  }

  const left = await waitForQueueDrained(page);
  if (left !== 0) {
    throw new Error(
      `smoke-auth-learning-path: progress queue did not drain after the server acked ` +
        `(${left ?? 'unreadable'} left).`
    );
  }

  console.log(
    `  step 2: ${enqueued.length} answered event(s) synced and acked ` +
      `(${posts.length} POSTs total, incl. guest-backlog catch-up)`
  );
}

/**
 * STEP 3 — Refresh and verify progress persistence.
 *
 * TODO: Reload, re-dismiss the entry screens, and assert progress survived.
 * TODO: Assert it survived from the SERVER, not just localStorage. Reuse
 *       `assertPersistedProgress`-style checks for the local half, but this
 *       step is only meaningful if the reconcile is what restores it — clear
 *       the local blob and let the (stubbed) server response repopulate it.
 * TODO: Add `VITE_SYNC_ENABLED: 'true'` to STUB_ENV. Step 2 does not need
 *       it (the progress flush is gated on a JWT), but the reconcile lane
 *       this step measures is a no-op without it — so today this step would
 *       be asserting on a lane that never ran.
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

/** Navigate to Vocab and select the seeded deck. */
async function openSeededDeck(page) {
  const nav = page.getByRole('navigation');
  const vocab = nav.getByRole('button', { name: 'Vocab', exact: true });
  await vocab.waitFor({ state: 'visible', timeout: 10000 });
  await vocab.click();
  if ((await vocab.getAttribute('aria-current')) !== 'page') {
    throw new Error('smoke-auth-learning-path: Vocab did not become the active tab.');
  }

  const food = page.getByRole('button', { name: /Food & Drink/i });
  await food.waitFor({ state: 'visible', timeout: 10000 });
  if ((await food.getAttribute('aria-pressed')) !== 'true') {
    await food.click();
    await page.waitForTimeout(300);
  }
  if ((await food.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('smoke-auth-learning-path: Food & Drink never became the selected deck.');
  }
}

/** One full signed-in walk at one viewport. */
async function walkViewport(context, page, vp, seed) {
  const label = `${vp.name}@${vp.width}`;
  console.log(`→ ${label}`);
  await page.setViewportSize({ width: vp.width, height: vp.height });

  // Closed to the real network first, then the progress lane on top — the
  // later registration wins in Playwright, so the specific route is the one
  // that answers. Unlike the guest smoke these ANSWER rather than 503,
  // because steps 2-4 assert on what comes back.
  const json = (body, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ error: 'smoke-offline' }, 503)));
  await page.route('**/auth/v1/**', (r) => r.fulfill(json({})));
  await page.route('**/rest/v1/**', (r) => r.fulfill(json([])));
  const posts = await captureProgressSync(page);

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  await stepRestoreSession(context, page, seed);
  await dismissEntryScreens(page);
  await stepViewportChecks(page, `${label} home`);

  await openSeededDeck(page);
  await stepCompleteExerciseAndSync(page, seed, posts);

  await stepRefreshAndVerifyPersistence(page, seed);
  await stepOpenLeagues(page);
  await stepAccountControlsAndLogout(page);

  console.log(`✓ ${label} (steps 1-2 asserted; 3-6 scaffolded)`);
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

  assertNoRealCredentials();
  // Three remaining, not the guest smoke's one: a single event cannot show
  // that ids are DISTINCT, which is the assertion that catches a replay.
  const seed = learningPathSeed({ remaining: 3 });
  console.log(
    `Seed: ${seed.learnedCards.length}/${seed.cards.length} of ${DECK_ID} learned, ` +
      `${seed.remainingCount} left; session key ${SESSION_KEY}`
  );

  const browser = await launchBrowser();
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext();
      await installBaselineSeed(context, seed);
      await installSignedInSeed(context, SESSION_KEY);
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
