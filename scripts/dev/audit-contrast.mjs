#!/usr/bin/env node
/**
 * Rendered-DOM contrast audit.
 *
 * Walks 2 modes × 2 tones × 5 tabs × 3 viewports with a populated account and
 * reports every text node whose contrast against its nearest opaque background
 * falls below WCAG AA (4.5:1 body / 3:1 large), plus any header popover that
 * renders outside the viewport (a class jsdom and scrollWidth both miss).
 *
 * Usage:
 *   npm run audit:contrast              # expects vite on :5290
 *   AUDIT_BASE=http://localhost:5173 npm run audit:contrast
 *
 * Exit 1 when any real finding remains (emoji-only nodes are excluded).
 */

import { chromium } from 'playwright';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:5290';
const MODES = ['light', 'dark'];
const TONES = ['day', 'night'];
const TABS = ['Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'];
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

const SHEET_SELECTOR = '[role="dialog"][aria-label="Appearance"]';

/** Toggle the Appearance chip. Returns false when the header has no chip. */
function clickThemeChip() {
  const chip = [...document.querySelectorAll('button')].find(
    (b) => (b.getAttribute('aria-label') || '').toLowerCase() === 'appearance'
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
  const sheet = document.querySelector('[role="dialog"][aria-label="Appearance"]');
  if (!sheet) return [{ reason: 'Appearance sheet vanished before measurement' }];
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
 */
async function auditThemeSheet(page) {
  if (!(await page.evaluate(clickThemeChip))) {
    return [{ reason: 'no Appearance chip in header' }];
  }
  try {
    await page.waitForSelector(SHEET_SELECTOR, { state: 'visible', timeout: 3000 });
  } catch {
    return [{ reason: 'Appearance sheet did not open' }];
  }
  // The sheet places itself in an effect after mount; measuring before that
  // runs would report the pre-placement position as clipped.
  await page.waitForTimeout(200);
  const out = await page.evaluate(measureOpenSheet);
  await page.evaluate(clickThemeChip); // close again before the tab walk
  return out;
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
  // WelcomeGate — "Try it first — free →". Clicking it forces the splash on,
  // regardless of a stored level, so the level step below is not optional
  // once this one fires.
  const gate = await page.$('.welcome-guest');
  if (gate) {
    await gate.click();
    await page.waitForTimeout(200);
  }

  // SplashScreen — level picker. Matched on its handler's effect rather than
  // its emoji label, which is decorative and free to change.
  const picked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /\(A1\)/.test(x.textContent || '')
    );
    if (!b) return false;
    b.click();
    return true;
  });
  if (picked) await page.waitForTimeout(300);

  // Fail loudly and once, rather than as 12 downstream "no Appearance chip"
  // findings that say nothing about the real cause.
  const onShell = await page.evaluate(() => Boolean(document.querySelector('header')));
  if (!onShell) {
    throw new Error(
      'audit-contrast: never reached the app shell — still on an entry screen ' +
        'after dismissing the gate and picking a level. The entry flow changed; ' +
        'update dismissEntryScreens().'
    );
  }
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
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Boot once so we can seed before the first themed reload.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(seedPopulatedAccount);

  const findings = [];
  const layout = [];
  let combinations = 0;

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

        for (const l of await auditThemeSheet(page)) {
          layout.push({ ...l, mode, tone, viewport: vp.width });
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
      }
    }
  }

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

  console.log(`Audited ${combinations} combinations (2×2×5×3).`);
  console.log(`Raw findings: ${findings.length}; unique: ${unique.length}`);
  console.log(`Header sheet layout findings: ${layout.length}`);

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
