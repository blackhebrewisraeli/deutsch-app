#!/usr/bin/env node
/**
 * Rendered-DOM contrast audit.
 *
 * Walks 2 modes × 2 tones × 6 tabs × 3 viewports with a populated account and
 * reports every text node whose contrast against its nearest opaque background
 * falls below WCAG AA (4.5:1 body / 3:1 large), plus any header popover that
 * renders outside the viewport (a class jsdom and scrollWidth both miss).
 *
 * Usage:
 *   npm run audit:contrast                         # builds and serves itself
 *   AUDIT_BASE=http://localhost:5290 npm run audit:contrast   # audit a server you already run
 *   AUDIT_SKIP_BUILD=1 npm run audit:contrast      # reuse the last audit build
 *
 * With no AUDIT_BASE this provisions its own target: a production build made
 * with STUB Supabase config, served from a scratch directory. That is not a
 * convenience — it is the difference between the audit running and not. The
 * signed-in pass seeds a session, and a build carrying a developer's REAL
 * VITE_SUPABASE_* rejects that seed, so the audit aborted with "the session
 * seed no longer satisfies useAuth" on every developer machine while passing
 * in CI. The gate was therefore CI-only for as long as that went unfixed, and
 * clipped sheets could only be caught after pushing.
 *
 * Setting AUDIT_BASE means "I am providing the server" and skips all of it,
 * which is the path CI takes — it builds and serves in the workflow so the
 * artifact under audit is the same one the other jobs produce.
 *
 * Exit 1 when any real finding remains (emoji-only nodes are excluded).
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The pinned vite binary, by absolute path, rather than `npx vite`.
//
// Two reasons, one of them security. Bare `npx` is resolved through PATH, and
// npx will fetch and execute a package from the registry when the name is not
// installed locally — so a shadowed PATH entry or a typo becomes arbitrary code
// on a machine that is mid-build (Sonar S4036). Spawning node_modules/.bin/vite
// directly removes both: no PATH lookup, no on-demand install, and the version
// is exactly what package-lock.json pinned.
//
// Derived from this file's own location, not process.cwd(), so the script
// behaves the same however it is invoked.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VITE_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'vite');

// Stub Supabase config, not credentials. `isAuthConfigured()` only checks that
// both values are truthy, so a fake host is enough to make the build render the
// account chrome the signed-in pass needs. Nothing here is secret and nothing
// reaches the network: the audit intercepts every call.
const STUB_ENV = {
  VITE_SUPABASE_URL: 'https://stub.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'stub-anon-key-not-a-secret',
  VITE_LEAGUES_ENABLED: 'true',
};

// A scratch build dir, so running the audit never clobbers a developer's own
// `dist/` — theirs is built from their real env and is not interchangeable
// with this one.
const OUT_DIR = 'dist-audit';
// Deliberately not 5290: that is CI's port and a developer may already be
// serving something there.
const AUDIT_PORT = Number(process.env.AUDIT_PORT ?? 5293);

const EXPLICIT_BASE = process.env.AUDIT_BASE;
const BASE = EXPLICIT_BASE ?? `http://localhost:${AUDIT_PORT}`;
// ─── Modals and drawers ───────────────────────────────────────────────────
//
// Header sheets are discovered from their triggers; full-screen modals cannot
// be, because reaching one is an app state rather than a button in a fixed
// place. They are therefore listed — but each entry OPENS the modal itself and
// the run fails if it does not appear, so a modal that stops being reachable
// reports that instead of silently dropping out of the audit.
//
// Both of these were unaudited before: the guest walk never signed in and never
// exhausted the trial, so neither surface had been measured in any mode.

/** The guest "Sign in" affordance lives in the header. */
function clickHeaderSignIn() {
  const btn = [...document.querySelectorAll('header button')].find(
    (b) => (b.textContent || '').trim().toLowerCase() === 'sign in'
  );
  if (!btn) return false;
  btn.click();
  return true;
}

function dismissAuthSheet() {
  const close = document.querySelector(
    '[aria-label="Close sign-in"], [aria-label="Dismiss sign-in"]'
  );
  if (close) close.click();
}

/**
 * Force the guest trial to read as exhausted, then nudge the app to re-derive.
 * A reload would also work and costs ~2s per combination; `deutsch:progress` is
 * the event App already recomputes `game` on, so the wall appears in place.
 */
function exhaustTrial() {
  const raw = localStorage.getItem('deutsch-app-state-v1');
  const state = raw ? JSON.parse(raw) : {};
  const day = Object.keys(state.daily ?? {})[0] ?? '2026-01-01';
  state.daily = state.daily ?? {};
  // Past TRIAL_ROUND_CAP (60). Set here rather than imported: this string is
  // serialized into the page, which has no access to the module graph.
  state.daily[day] = { ...(state.daily[day] ?? {}), total: 99 };
  localStorage.setItem('deutsch-app-state-v1', JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('deutsch:progress'));
}

function restoreTrial() {
  const raw = localStorage.getItem('deutsch-app-state-v1');
  const state = raw ? JSON.parse(raw) : {};
  for (const key of Object.keys(state.daily ?? {})) delete state.daily[key].total;
  localStorage.setItem('deutsch-app-state-v1', JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('deutsch:progress'));
}

/** Measure whichever modal is open: geometry, same rules as a header sheet. */
function measureOpenModal(selector) {
  const el = document.querySelector(selector);
  if (!el) return [{ reason: 'modal vanished before measurement' }];
  const vw = document.documentElement.clientWidth;
  const out = [];
  const r = el.getBoundingClientRect();
  if (r.left < 0 || r.right > vw) {
    out.push({
      reason: 'modal outside viewport',
      left: +r.left.toFixed(1),
      right: +r.right.toFixed(1),
      vw,
    });
  }
  for (const node of el.querySelectorAll('*')) {
    if (![...node.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const b = node.getBoundingClientRect();
    if (b.left < 0 || b.right > vw) {
      out.push({
        reason: 'modal content clipped',
        text: node.textContent.trim().slice(0, 24),
        left: +b.left.toFixed(1),
      });
    }
  }
  return out;
}

const MODALS = [
  {
    name: 'sign-in',
    // Native <dialog open> — implicit role="dialog", so aria-modal is real
    // here and this selector reaches it.
    selector: 'dialog[open]',
    open: async (page) => page.evaluate(clickHeaderSignIn),
    close: async (page) => page.evaluate(dismissAuthSheet),
  },
  {
    name: 'trial wall',
    selector: '[role="dialog"][aria-label="Save your progress"]',
    // The wall waits for `toasts.length === 0` BY DESIGN — App holds it back
    // so a running goal/streak celebration finishes before the wall lands.
    // Seeding progress re-runs that celebration, so the wall appears a few
    // seconds later, not immediately. A 3s timeout reported it as unreachable;
    // Playwright polls, so a longer bound costs only the wait actually needed.
    timeout: 10000,
    open: async (page) => {
      // Must be on a PRACTICE tab: the wall deliberately never covers Stats,
      // which is the escape hatch to sign in from. The tab walk ends on Stats,
      // so without this the wall can never appear and the audit reports it as
      // unreachable — which is what it did on the first run.
      await openTab(page, 'Vocab');
      await page.evaluate(exhaustTrial);
      return true;
    },
    close: async (page) => page.evaluate(restoreTrial),
  },
];

async function auditModals(page) {
  const layout = [];
  const contrast = [];
  let measured = 0;

  for (const modal of MODALS) {
    const opened = await modal.open(page);
    if (opened === false) {
      layout.push({ reason: `no way to open the ${modal.name} modal`, modal: modal.name });
      continue;
    }
    try {
      await page.waitForSelector(modal.selector, {
        state: 'visible',
        timeout: modal.timeout ?? 3000,
      });
    } catch {
      layout.push({ reason: `${modal.name} modal did not open`, modal: modal.name });
      await modal.close(page);
      continue;
    }
    await page.waitForTimeout(200);
    measured += 1;
    for (const f of await page.evaluate(measureOpenModal, modal.selector)) {
      layout.push({ ...f, modal: modal.name });
    }
    for (const f of await page.evaluate(collectFindings, `modal:${modal.name}`)) {
      contrast.push(f);
    }
    await modal.close(page);
    await page.waitForTimeout(150);
  }

  if (measured < MODALS.length) {
    layout.push({
      reason: `expected ${MODALS.length} modals, measured ${measured}`,
    });
  }
  return { layout, contrast, measured };
}

// ─── Provisioning the target ──────────────────────────────────────────────
//
// Only used when the caller did not supply AUDIT_BASE.

let previewServer = null;

/**
 * Kill the preview if we started one. Registered on `exit` because the audit
 * ends via process.exit() in several places — a cleanup that only ran at the
 * bottom of main() would leak the server on every non-zero result, which is
 * exactly the run you repeat while fixing something.
 */
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
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
    );
  });
}

/** Poll rather than sleep — a fixed wait is how this becomes flaky. */
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

/** Newest mtime anywhere under `dir`, so a build can be compared to its input. */
function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(full) : statSync(full).mtimeMs);
  }
  return newest;
}

async function provisionTarget() {
  if (process.env.AUDIT_SKIP_BUILD === '1') {
    const built = `${OUT_DIR}/index.html`;
    if (!existsSync(built)) {
      throw new Error(
        `AUDIT_SKIP_BUILD=1 but ${OUT_DIR}/ has no build to reuse. Run once without it.`
      );
    }
    console.log(`Reusing the existing ${OUT_DIR}/ build (AUDIT_SKIP_BUILD=1).`);
    // Say so when the build no longer matches its input. Auditing a stale
    // artifact reports on code that is not on disk any more, and it looks
    // exactly like auditing the real thing — that is how a deliberately
    // broken control once "passed" against a dist whose build had failed.
    // Only fires when src/ actually moved, so skipping the build while
    // iterating on THIS script stays quiet, which is what the flag is for.
    const srcMs = newestMtime('src');
    const builtMs = statSync(built).mtimeMs;
    if (srcMs > builtMs) {
      const mins = Math.round((srcMs - builtMs) / 60000);
      console.log(
        `⚠ src/ is ${mins} minute(s) NEWER than ${OUT_DIR}/ — you are auditing a stale ` +
          'build. Drop AUDIT_SKIP_BUILD to rebuild.'
      );
    }
  } else {
    console.log(`Building with stub Supabase config → ${OUT_DIR}/`);
    // STUB_ENV is passed through the environment, which Vite resolves ahead of
    // any .env file, so a developer's real credentials do not win here.
    await run(VITE_BIN, ['build', '--outDir', OUT_DIR], STUB_ENV);
  }

  console.log(`Serving ${OUT_DIR}/ on :${AUDIT_PORT}`);
  previewServer = spawn(
    VITE_BIN,
    ['preview', '--outDir', OUT_DIR, '--port', String(AUDIT_PORT), '--strictPort'],
    { stdio: 'ignore' }
  );
  previewServer.on('error', (err) => {
    console.error(`preview server failed to start: ${err.message}`);
  });

  const waited = await waitForServer(BASE);
  if (waited < 0) {
    throw new Error(
      `preview never answered on ${BASE}. If something else holds :${AUDIT_PORT}, ` +
        'set AUDIT_PORT, or set AUDIT_BASE to audit a server you are running yourself.'
    );
  }
  console.log(`preview up after ${waited}s`);
}

const MODES = ['light', 'dark'];
const TONES = ['day', 'night'];
const TABS = ['Home', 'Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'];
// The signed-in pass sweeps mode x tone at one viewport. Contrast is a function
// of the palette, not the width; width only moves things around, and the guest
// walk already covers all three widths for the shared chrome.
const SIGNED_IN_VIEWPORT = { width: 390, height: 800 };

// supabase-js stores its session under `sb-<project-ref>-auth-token`, where the
// ref is the first label of the API host. Derived rather than hardcoded so this
// works both in CI (which builds against a stub host) and on a developer box
// whose .env points at the real project.
const SUPABASE_REF = (process.env.VITE_SUPABASE_URL ?? 'https://stub.supabase.co')
  .replace(/^https?:\/\//, '')
  .split('.')[0];
const SESSION_KEY = `sb-${SUPABASE_REF}-auth-token`;

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 800 },
  { width: 320, height: 800 },
];

/** Seed streak + freeze chip so header density matches a real learner. */
function seedPopulatedAccount() {
  const qual = { byLevel: { a1: { correct: 6, almost: 0, wrong: 0 } } };
  const daily = {};
  const today = new Date();
  for (let i = 14; i >= 1; i -= 1) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - i);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    daily[`${y}-${m}-${d}`] = qual;
  }
  // Nothing reads this key since #116; written only because AGENTS.md forbids
  // removing a storage key. Getting past the entry screen is dismissEntryScreens().
  localStorage.setItem('deutsch-onboarded', '1');
  localStorage.setItem('deutsch-welcome-dismissed', '1');
  localStorage.setItem('deutsch-level', 'a1');
  localStorage.setItem(
    'deutsch-app-state-v1',
    JSON.stringify({
      daily,
      gamification: { goal: 50 },
      stats: { streak: 0, learnedCount: 40 },
    })
  );
}

/** In-page walker — kept as a string so Playwright can serialize it. */
function collectFindings(tabName) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).map(Number);
  const opaqueBg = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] > 0.9)) return c;
      n = n.parentElement;
    }
    // Resolve --c-ground from :root (body itself has no background).
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--c-ground').trim();
    if (raw.startsWith('#')) {
      const hex = raw.slice(1);
      const full =
        hex.length === 3
          ? hex
              .split('')
              .map((ch) => ch + ch)
              .join('')
          : hex.slice(0, 6);
      const n = parseInt(full, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return [13, 13, 15];
  };

  // Emoji (and emoji ZWJ sequences) render in their own colours — a low
  // computed ratio on an emoji-only node is a false positive.
  const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\u20E3|\uFE0E|\s)+$/u;

  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const txt = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join('');
    if (txt.length < 2) continue;
    if (EMOJI_ONLY.test(txt)) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || st.opacity === '0') continue;
    const fg = parse(st.color);
    const bg = opaqueBg(el);
    if (fg.length < 3) continue;
    const l1 = lum(fg[0], fg[1], fg[2]);
    const l2 = lum(bg[0], bg[1], bg[2]);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const size = parseFloat(st.fontSize);
    const bold = parseInt(st.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const floor = large ? 3 : 4.5;
    if (ratio < floor) {
      out.push({
        tab: tabName,
        ratio: +ratio.toFixed(2),
        floor,
        fg: st.color,
        bg: `rgb(${bg.slice(0, 3).join(',')})`,
        size,
        text: txt.slice(0, 48),
      });
    }
  }
  return out;
}

const SHEET_SELECTOR = '[role="dialog"]';

/**
 * How many header sheets each pass expects to find. A floor, not an exact
 * count, so adding a sheet does not break the build — but removing the
 * discovery mechanism does.
 *
 * Guest sees two: ThemeChip's Appearance sheet and StatusChip's Status sheet.
 * A signed-in user also gets AccountChip's Account sheet, which renders only
 * with a session — so a single global floor would either miss it or fail the
 * guest walk.
 */
const MIN_HEADER_SHEETS_GUEST = 2;
const MIN_HEADER_SHEETS_SIGNED_IN = 3;

/**
 * Every header popover, DISCOVERED rather than named.
 *
 * This used to select the Appearance chip by its literal aria-label, so when
 * StatusChip added a second header sheet the audit went on measuring only the
 * first one — and reported "Header sheet layout findings: 0", which reads as
 * "all header sheets are fine" but meant "the one sheet I look at is fine".
 * Discovery by role keeps a future sheet covered on the day it lands rather
 * than the day someone remembers to add it here.
 */
function listSheetTriggers() {
  const header = document.querySelector('header');
  if (!header) return [];
  return [...header.querySelectorAll('button[aria-haspopup="dialog"]')].map(
    (b) => b.getAttribute('aria-label') || ''
  );
}

/** Toggle one header sheet by its trigger's accessible name. */
function clickSheetTrigger(label) {
  const header = document.querySelector('header');
  if (!header) return false;
  const chip = [...header.querySelectorAll('button[aria-haspopup="dialog"]')].find(
    (b) => (b.getAttribute('aria-label') || '') === label
  );
  if (!chip) return false;
  chip.click();
  return true;
}

/**
 * Measure an already-open sheet. Kept as a string so Playwright can serialize
 * it, and deliberately free of clicking — see auditThemeSheet below.
 */
function measureOpenSheet() {
  const sheet = document.querySelector('[role="dialog"]');
  if (!sheet) return [{ reason: 'sheet vanished before measurement' }];
  const vw = document.documentElement.clientWidth;
  const out = [];
  const r = sheet.getBoundingClientRect();
  if (r.left < 0 || r.right > vw) {
    out.push({
      reason: 'sheet outside viewport',
      left: +r.left.toFixed(1),
      right: +r.right.toFixed(1),
      vw,
    });
  }
  for (const el of sheet.querySelectorAll('*')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const b = el.getBoundingClientRect();
    if (b.left < 0 || b.right > vw) {
      out.push({
        reason: 'sheet content clipped',
        text: el.textContent.trim().slice(0, 24),
        left: +b.left.toFixed(1),
      });
    }
  }
  return out;
}

/**
 * Header popovers must stay inside the viewport. `scrollWidth` cannot see this:
 * an absolutely-positioned sheet that hangs off the *left* edge is clipped, not
 * scrolled, so every overflow assertion passes while the controls are cut off.
 * The ThemeChip sheet shipped 65.7px off-screen at 320px for exactly that reason.
 *
 * The click and the measurement have to be separate round trips. Doing both
 * inside one page.evaluate reads the DOM before React has rendered the sheet,
 * which reported "sheet did not open" for all 12 mode×tone×viewport
 * combinations and made this script exit 1 unconditionally — the reason it was
 * never wired into CI.
 *
 * Drives EVERY header sheet, and also colour-audits each one's interior while
 * it is open. Both were previously limited to the Appearance sheet by name.
 */
async function auditHeaderSheets(page, minSheets, passLabel = 'guest') {
  const triggers = await page.evaluate(listSheetTriggers);
  const layout = [];
  const contrast = [];

  // A sheet audit that measures nothing reports exactly what a clean one
  // reports. That is not hypothetical: naming a single sheet is how the Status
  // sheet went unaudited, and the totals looked healthy throughout. Assert the
  // coverage, not just the result.
  if (triggers.length < minSheets) {
    layout.push({
      reason: `expected at least ${minSheets} header sheets in the ${passLabel} pass, found ${triggers.length}`,
      found: triggers.join(' | ') || '(none)',
    });
  }

  for (const label of triggers) {
    const short = label.slice(0, 32);
    if (!(await page.evaluate(clickSheetTrigger, label))) {
      layout.push({ reason: 'sheet trigger vanished', sheet: short });
      continue;
    }
    try {
      await page.waitForSelector(SHEET_SELECTOR, { state: 'visible', timeout: 3000 });
    } catch {
      layout.push({ reason: 'sheet did not open', sheet: short });
      continue;
    }
    // The sheet places itself in an effect after mount; measuring before that
    // runs would report the pre-placement position as clipped.
    await page.waitForTimeout(200);

    for (const f of await page.evaluate(measureOpenSheet)) {
      layout.push({ ...f, sheet: short });
    }
    // Contrast INSIDE the sheet. The tab walk below runs with every sheet
    // closed, and a closed sheet contributes no pairings at all — so the
    // interior of these popovers was never colour-audited either, not just
    // their geometry.
    for (const f of await page.evaluate(collectFindings, `sheet:${short}`)) {
      contrast.push(f);
    }

    await page.evaluate(clickSheetTrigger, label); // close before the next one
  }

  return { layout, contrast, measured: triggers.length };
}

/**
 * Walk the entry screens if they are up, then assert we reached the app shell.
 *
 * Whether they appear at all depends on the BUILD, not on this script: the gate
 * renders only when `isAuthConfigured()` — i.e. only when VITE_SUPABASE_* were
 * present at build time. CI has no Supabase env, so CI never saw the gate and
 * the audit passed; any developer with a populated `.env` audited the entry
 * screen instead of the app and got 12 header-sheet findings with exit 1.
 *
 * Both paths are therefore optional and idempotent, and this runs after EVERY
 * reload rather than once at boot: `gateDismissed` is React state, not storage
 * (deliberately — the gate is a property of "is there a session"), so it comes
 * back on every load. The guest route is used rather than a faked `sb-*-auth-token`
 * because a forged token buys nothing: the Supabase client rejects it, authStatus
 * settles on 'anonymous', and the gate returns.
 */
async function dismissEntryScreens(page) {
  // WelcomeGate — "Try it first — free →". Landing directly on the app shell
  // (Home tab) once dismissed — there is no longer a level-picker screen
  // behind it.
  // `[data-entry="guest"]`, not the old `.welcome-guest` class: that class only
  // ever existed to carry a scoped :focus-visible rule, and when the app moved
  // to one global focus ring the class went with it — taking this selector's
  // only way past the gate. This hook is named for what the button is, so a
  // styling change cannot silently remove it.
  const gate = await page.$('[data-entry="guest"]');
  if (gate) {
    await gate.click();
    await page.waitForTimeout(200);
  }

  // Fail loudly and once, rather than as 12 downstream "no Appearance chip"
  // findings that say nothing about the real cause.
  const onShell = await page.evaluate(() => Boolean(document.querySelector('header')));
  if (!onShell) {
    throw new Error(
      'audit-contrast: never reached the app shell — still on an entry screen ' +
        'after dismissing the gate. The entry flow changed; update dismissEntryScreens().'
    );
  }
}

/**
 * Seed a signed-in session.
 *
 * `useAuth` sets status from `client.auth.getSession()`, and supabase-js
 * resolves that from storage without a network round-trip so long as the
 * session has not expired. So a well-formed stub session is enough to render
 * the account chrome — no credentials, and nothing real to leak into CI.
 * (An earlier note in this repo claimed a forged token "buys nothing because
 * the client rejects it". That is wrong, and this pass depends on it being
 * wrong: only `getUser()` round-trips.)
 */
function seedSignedInSession(key) {
  localStorage.setItem(
    key,
    JSON.stringify({
      access_token: 'audit.stub.token',
      token_type: 'bearer',
      expires_in: 3600,
      // Comfortably ahead of the run so supabase-js never tries to refresh.
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'audit-stub-refresh',
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'auditor@example.test',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00.000Z',
      },
    })
  );
}

/**
 * Answer the league + profile calls with fixtures.
 *
 * Without these the leaderboard renders "Couldn't load your league." — one
 * short error line, which is precisely the state that hides every colour the
 * populated widget uses (tier heading, rank rows, promote/demote zones).
 * A fixture that cannot show the real surface cannot audit it.
 */
async function stubAccountNetwork(page) {
  const json = (body) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  // Monday of the current week, so the countdown renders a real remainder.
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  await page.route('**/api/v1/league/join', (r) =>
    r.fulfill(json({ league_id: 'audit-league', tier: 2, period_start: monday.toISOString() }))
  );
  await page.route('**/api/v1/league/refresh', (r) => r.fulfill(json({ ok: true })));
  await page.route('**/api/v1/league/profile*', (r) =>
    r.fulfill(
      json({
        handle: 'Auditor',
        tier: 2,
        total_xp: 4200,
        longest_streak: 31,
        avatar_emoji: '🦊',
      })
    )
  );

  // Enough rows to populate the promotion zone, the demotion zone and the
  // untouched middle — the three row styles the widget colours differently.
  await page.route('**/rest/v1/league_members*', (r) =>
    r.fulfill(
      json(
        Array.from({ length: 12 }, (_, i) => ({
          user_id: i === 3 ? '00000000-0000-4000-8000-000000000001' : `peer-${i}`,
          handle: i === 3 ? 'Auditor' : `Lernende ${i + 1}`,
          weekly_xp: 900 - i * 70,
          rank: i + 1,
        }))
      )
    )
  );

  // Any other Supabase traffic (token refresh, telemetry) fails closed rather
  // than reaching the network from CI.
  await page.route('**/auth/v1/**', (r) => r.fulfill(json({})));
}

/**
 * Contrast-audit the chrome only a signed-in account ever renders: the header
 * AccountChip, the Stats account section, the league table, and the profile
 * card. The guest walk cannot reach any of it — before this pass those
 * surfaces had never been measured in any mode.
 */
async function auditSignedIn(page, mode, tone) {
  await page.evaluate(
    ({ m, t, key }) => {
      localStorage.setItem('deutsch-theme-mode', m);
      localStorage.setItem('deutsch-theme-tone', t);
      localStorage.setItem('deutsch-level', 'a1');
      return key;
    },
    { m: mode, t: tone, key: SESSION_KEY }
  );
  await page.evaluate(seedPopulatedAccount);
  await page.evaluate(seedSignedInSession, SESSION_KEY);
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Longer than the guest walk: the Supabase client is code-split, and the
  // league table only paints after join -> refresh -> standings resolve.
  await page.waitForTimeout(1200);

  const signedIn = await page.evaluate(() => Boolean(document.querySelector('header')));
  if (!signedIn) {
    throw new Error(
      `audit-contrast: signed-in pass never reached the app shell (${mode}.${tone}). ` +
        'The session seed no longer satisfies useAuth — check SESSION_KEY and expires_at.'
    );
  }

  const out = [];
  const sheetLayout = [];

  // The header sheets again, now that a session exists — this is the only pass
  // in which AccountChip renders a sheet at all. Its trigger "rode along" in
  // the colour sweep below, but its CONTENTS (the email line, the red Sign
  // out) were never opened, so they were never measured for contrast or for
  // clipping. A sheet that is never opened contributes no pairings.
  const signedInSheets = await auditHeaderSheets(page, MIN_HEADER_SHEETS_SIGNED_IN, 'signed-in');
  out.push(...signedInSheets.contrast);
  sheetLayout.push(...signedInSheets.layout);

  // Stats' default view — this is where AccountSection renders for a signed-in
  // user (email, export, handle field). The header AccountChip rides along.
  await openTab(page, 'Stats');
  await page.waitForTimeout(700);
  out.push(...(await page.evaluate(collectFindings, 'Stats/signed-in')));

  // The league table sits behind a view toggle, not behind the tab. Opening
  // Stats alone leaves it unrendered — which is exactly how it stayed
  // unaudited while the job reported clean.
  const onLeagues = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => (x.getAttribute('aria-label') || '') === 'leagues'
    );
    if (!b) return false;
    b.click();
    return true;
  });
  if (!onLeagues) {
    throw new Error(
      `audit-contrast: no LEAGUES toggle on Stats (${mode}.${tone}) — either the ` +
        'build lacks VITE_LEAGUES_ENABLED=true or the toggle moved.'
    );
  }
  // join -> refresh -> standings are three sequential round trips, and a fixed
  // sleep here is exactly how this pass first measured an EMPTY table and still
  // reported clean. Wait for the rows themselves; `rowsRendered` then gates the
  // profile-card step so a fixture that stops rendering is reported, not counted
  // as coverage.
  let rowsRendered = true;
  try {
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('li')].some((el) => /Lernende/.test(el.textContent || '')),
      { timeout: 8000 }
    );
  } catch {
    rowsRendered = false;
  }
  out.push(...(await page.evaluate(collectFindings, 'Leagues/signed-in')));

  // The profile card is a modal off a league row. Report when it does not open,
  // so a broken fixture cannot pass as clean coverage.
  // Rows are clickable <li>, not <button> — searching for a button here is what
  // made the first version of this pass report 0/4 while looking clean.
  // BUG: those <li onClick> rows are not keyboard reachable (no role, no
  // tabindex, no key handler), so the league table cannot be opened without a
  // mouse. Out of scope here; flagged per AGENTS.md rather than fixed silently.
  const opened =
    rowsRendered &&
    (await page.evaluate(() => {
      // Match the handle alone. A row's textContent concatenates its spans with
      // no separator — "1. Lernende 1900 XP" — so an anchored `Lernende 1\b`
      // never matches, which is what made this report 0/4 while the table was
      // rendering all 11 rows perfectly well.
      const row = [...document.querySelectorAll('li')].find((el) =>
        /Lernende/.test(el.textContent || '')
      );
      if (!row) return false;
      row.click();
      return true;
    }));
  if (opened) {
    await page.waitForTimeout(600);
    out.push(...(await page.evaluate(collectFindings, 'ProfileCard')));
  }

  return {
    findings: out,
    profileCardOpened: opened,
    sheetLayout,
    sheetsMeasured: signedInSheets.measured,
  };
}

async function applyTheme(page, mode, tone) {
  await page.evaluate(
    ({ mode: m, tone: t }) => {
      localStorage.setItem('deutsch-theme-mode', m);
      localStorage.setItem('deutsch-theme-tone', t);
    },
    { mode, tone }
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await dismissEntryScreens(page);
}

async function openTab(page, tab) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      new RegExp(`^\\s*${t}\\s*$`, 'i').test(x.getAttribute('aria-label') || x.textContent || '')
    );
    if (b) b.click();
  }, tab);
  await page.waitForTimeout(700);
}

async function main() {
  // Build and serve our own target unless the caller supplied one. Done before
  // the browser launches so a build failure costs nothing but the build.
  if (EXPLICIT_BASE) console.log(`Auditing the server at ${BASE} (AUDIT_BASE set).`);
  else await provisionTarget();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Boot once so we can seed before the first themed reload.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(seedPopulatedAccount);

  const findings = [];
  const layout = [];
  let sheetsMeasured = 0;
  let signedInSheetsMeasured = 0;
  let modalsMeasured = 0;
  let combinations = 0;
  let signedInCombinations = 0;

  for (const mode of MODES) {
    for (const tone of TONES) {
      for (const vp of VIEWPORTS) {
        await page.setViewportSize(vp);
        await applyTheme(page, mode, tone);
        // Re-seed after reload (reload keeps localStorage, but be explicit).
        await page.evaluate(seedPopulatedAccount);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(400);
        await dismissEntryScreens(page);

        const sheets = await auditHeaderSheets(page, MIN_HEADER_SHEETS_GUEST, 'guest');
        sheetsMeasured = Math.max(sheetsMeasured, sheets.measured);
        for (const l of sheets.layout) {
          layout.push({ ...l, mode, tone, viewport: vp.width });
        }
        for (const f of sheets.contrast) {
          findings.push({ ...f, mode, tone, viewport: vp.width });
        }

        for (const tab of TABS) {
          combinations += 1;
          await openTab(page, tab);
          const bad = await page.evaluate(collectFindings, tab);
          for (const f of bad) {
            findings.push({
              ...f,
              mode,
              tone,
              viewport: vp.width,
            });
          }
        }

        // Last in the iteration: opening the trial wall mutates stored
        // progress, so it must not run before the tab walk it would change.
        // The next iteration re-seeds and reloads, so nothing carries over.
        const modals = await auditModals(page);
        modalsMeasured = Math.max(modalsMeasured, modals.measured);
        for (const l of modals.layout) {
          layout.push({ ...l, mode, tone, viewport: vp.width });
        }
        for (const f of modals.contrast) {
          findings.push({ ...f, mode, tone, viewport: vp.width });
        }
      }
    }
  }

  // ── Signed-in pass ────────────────────────────────────────────────────────
  // A separate context: the guest walk's storage and the stub routes must not
  // bleed into each other, and the guest surfaces (WelcomeGate, TrialWall) are
  // only reachable without a session.
  const signedInContext = await browser.newContext();
  const signedInPage = await signedInContext.newPage();
  await signedInPage.setViewportSize(SIGNED_IN_VIEWPORT);
  await stubAccountNetwork(signedInPage);
  await signedInPage.goto(BASE, { waitUntil: 'domcontentloaded' });

  let profileCardsAudited = 0;
  for (const mode of MODES) {
    for (const tone of TONES) {
      signedInCombinations += 1;
      const res = await auditSignedIn(signedInPage, mode, tone);
      if (res.profileCardOpened) profileCardsAudited += 1;
      signedInSheetsMeasured = Math.max(signedInSheetsMeasured, res.sheetsMeasured);
      for (const l of res.sheetLayout) {
        layout.push({ ...l, mode, tone, viewport: SIGNED_IN_VIEWPORT.width, pass: 'signed-in' });
      }
      for (const f of res.findings) {
        findings.push({ ...f, mode, tone, viewport: SIGNED_IN_VIEWPORT.width });
      }
    }
  }
  await signedInContext.close();

  await browser.close();

  // Dedupe by stable key so one bug is not reported 60 times.
  const seen = new Set();
  const unique = [];
  for (const f of findings) {
    const key = [f.mode, f.tone, f.tab, f.text, f.ratio, f.fg, f.bg].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(f);
  }

  console.log(`Audited ${combinations} guest combinations (2×2×5×3).`);
  console.log(
    `Audited ${signedInCombinations} signed-in combinations (2×2) — ` +
      `AccountChip, account section, league table; ${profileCardsAudited} with the profile card.`
  );
  console.log(`Raw findings: ${findings.length}; unique: ${unique.length}`);
  console.log(
    `Header sheets measured per combination: ${sheetsMeasured} guest / ` +
      `${signedInSheetsMeasured} signed-in (geometry + interior contrast); ` +
      `layout findings: ${layout.length}`
  );
  console.log(
    `Modals measured per combination: ${modalsMeasured}/${MODALS.length} ` +
      `(${MODALS.map((m) => m.name).join(', ')})`
  );

  // A silent zero here would mean the league fixture stopped rendering, which
  // looks identical to "no findings" in the totals above.
  if (profileCardsAudited < signedInCombinations) {
    console.log(
      `⚠ profile card opened in only ${profileCardsAudited}/${signedInCombinations} signed-in ` +
        'combinations — the league table fixture may have stopped rendering.'
    );
  }

  for (const l of layout) {
    console.log(`[${l.mode}.${l.tone} @${l.viewport}] ${l.reason} ${JSON.stringify(l)}`);
  }

  if (unique.length === 0 && layout.length === 0) {
    console.log('✓ zero real contrast findings, no clipped header sheets');
    process.exit(0);
  }

  for (const f of unique.slice(0, 80)) {
    console.log(
      `[${f.mode}.${f.tone} @${f.viewport} ${f.tab}] ${f.ratio}:1 (need ${f.floor}) ` +
        `"${f.text}" fg=${f.fg} bg=${f.bg} size=${f.size}`
    );
  }
  if (unique.length > 80) console.log(`…and ${unique.length - 80} more`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
