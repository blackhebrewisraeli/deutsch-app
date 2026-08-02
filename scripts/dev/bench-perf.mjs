#!/usr/bin/env node
/**
 * Main-thread performance benchmark.
 *
 * Measures what the app actually costs a phone: blocked main-thread time during
 * load and during the interactions that matter (tab switches, deck selection,
 * answering a card), plus first paint.
 *
 * TWO MEASUREMENT TRAPS THIS HARNESS EXISTS TO AVOID
 * --------------------------------------------------
 * 1. A *hidden* browser tab throttles timers, which inflates `longtask`
 *    entries into multi-second phantoms. Headless Chromium never backgrounds a
 *    page. Do not "improve" this by driving a headed browser you also click in.
 *
 * 2. Clicks dispatched via `page.evaluate(() => el.click())` run inside a CDP
 *    evaluation task and produce NO longtask/LoAF entries whatsoever — the page
 *    reports a serene 0ms while genuinely blocking for a second. Measured
 *    directly: the same tab switch reported `[]` via evaluate-click and
 *    `[119, 723]` via real input. Every interaction below therefore goes
 *    through real Playwright input, and every click is asserted to have landed.
 *
 * A benchmark that silently measures nothing is worse than no benchmark, so a
 * click that does not change the app's state is a hard failure, not a 0ms row.
 *
 * The account size is a first-class variable: app state is one localStorage
 * blob that is parsed synchronously, and it grows for the life of the account.
 * A fresh 1KB account hides that entirely, so every scenario runs against a
 * realistic account by default.
 *
 * Usage:
 *   npm run build && npm run preview -- --port 4290 --strictPort
 *   npm run bench:perf
 *   npm run bench:perf -- --cpu 1 --account small
 *   npm run bench:perf -- --json baseline.json      # write machine-readable
 *   npm run bench:perf -- --compare baseline.json   # diff against a baseline
 *
 * Exits 0 always unless --compare finds a regression beyond --tolerance.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const BASE = process.env.BENCH_BASE ?? 'http://localhost:4290';
const CPU = Number(flag('cpu', 4));
const ACCOUNT = flag('account', 'large');
const JSON_OUT = flag('json', null);
const COMPARE = flag('compare', null);
const TOLERANCE = Number(flag('tolerance', 0.25));
// Blocked time is noisy run to run (a single tab mount swung 75→336ms across
// three runs). Medians over a few passes are what make small deltas readable.
const RUNS = Number(flag('runs', 3));

/**
 * Build an app-state blob. `large` models a committed learner after a year:
 * daily history never expires and SRS gains an entry per card ever seen, so
 * this is the shape the app trends toward, not a worst case.
 */
function buildState(size) {
  const daily = {};
  const days = size === 'large' ? 365 : 14;
  const today = new Date();
  for (let i = days; i >= 0; i -= 1) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - i);
    daily[dt.toISOString().slice(0, 10)] = {
      byLevel: { a1: { correct: 6 + (i % 5), almost: i % 3, wrong: i % 4 } },
      xp: 40 + (i % 60),
    };
  }
  const state = { daily, gamification: { goal: 50 }, stats: { streak: days, learnedCount: 40 } };
  if (size === 'large') {
    const srs = {};
    for (let i = 0; i < 2500; i += 1) {
      srs[`de:word${i}`] = {
        box: i % 6,
        nextDue: Date.now() + (i % 40) * 86400000,
        lastReviewed: Date.now() - (i % 20) * 86400000,
      };
    }
    const items = {};
    for (let i = 0; i < 600; i += 1) {
      items[`de:item${i}`] = { wrong: 1 + (i % 4), last: Date.now() - i * 3600000 };
    }
    state.srs = srs;
    state.items = items;
    state.stats = { streak: 120, learnedCount: 1800 };
  }
  return state;
}

/** Injected before any app code: collects long tasks and long animation frames. */
function installCollector() {
  window.__bench = { longtasks: [], loaf: [] };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__bench.longtasks.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* older Chromium — LoAF below still carries the signal */
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__bench.loaf.push(Math.round(e.blockingDuration));
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {
    /* LoAF unsupported — longtask above still carries the signal */
  }
}

/** Sum of the portion of each long task beyond 50ms — the standard TBT metric. */
const totalBlocking = (tasks) => tasks.reduce((a, ms) => a + Math.max(0, ms - 50), 0);

const collect = (page) =>
  page.evaluate(() => ({
    longtasks: window.__bench.longtasks.slice(),
    loaf: window.__bench.loaf.slice(),
  }));

const reset = (page) =>
  page.evaluate(() => {
    window.__bench.longtasks.length = 0;
    window.__bench.loaf.length = 0;
  });

function summarise(label, { longtasks, loaf }, wallMs) {
  return {
    label,
    blockedMs: longtasks.reduce((a, b) => a + b, 0),
    tbtMs: totalBlocking(longtasks),
    loafBlockingMs: loaf.reduce((a, b) => a + b, 0),
    longestTaskMs: longtasks.length ? Math.max(...longtasks) : 0,
    taskCount: longtasks.length,
    wallMs,
  };
}

/**
 * Run one interaction and measure it.
 *
 * `locator` is resolved to an element handle BEFORE the counters are reset:
 * Playwright's `getByRole` computes accessible names for every candidate in the
 * page, which is genuine main-thread work and was otherwise being charged to
 * the app (it dominated the CPU profile). Only the click and the app's response
 * fall inside the measured window.
 *
 * A click that does not visibly take effect is a hard failure, not a 0ms row.
 */
async function measure(page, label, locator, verify, settleMs = 2500) {
  const el = await locator.elementHandle({ timeout: 8000 }).catch(() => null);
  if (!el) throw new Error(`bench: "${label}" — no element matched, refusing to report 0ms.`);

  await reset(page);
  const t0 = Date.now();
  await el.click();
  if (verify) {
    try {
      await page.waitForFunction(verify, null, { timeout: 8000 });
    } catch {
      throw new Error(
        `bench: "${label}" did not take effect — the click landed on nothing. ` +
          `Refusing to report a 0ms result for an interaction that never happened.`
      );
    }
  }
  await page.waitForTimeout(settleMs);
  return summarise(label, await collect(page), Date.now() - t0 - settleMs);
}

const tabLocator = (page, name) =>
  page.getByRole('button', { name: new RegExp(`^\\s*(0\\d\\s*)?${name}\\s*$`, 'i') }).first();

/** Real trusted input, not el.click() from evaluate — see the header note. */
const clickTab = async (page, name) => {
  const el = await tabLocator(page, name).elementHandle({ timeout: 8000 });
  await el.click();
};

async function runOnce() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const cdp = await context.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

  await page.addInitScript(installCollector);

  // Seed before the measured load so the app boots against a realistic account.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const state = buildState(ACCOUNT);
  await page.evaluate((s) => {
    localStorage.setItem('deutsch-app-state-v1', JSON.stringify(s));
    localStorage.setItem('deutsch-onboarded', '1');
    localStorage.setItem('deutsch-welcome-dismissed', '1');
    localStorage.setItem('deutsch-level', 'a1');
  }, state);

  const results = [];

  // ── Cold load ───────────────────────────────────────────────
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const paint = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      fcpMs: Math.round(fcp?.startTime ?? 0),
      domInteractiveMs: Math.round(nav?.domInteractive ?? 0),
      stateKB: Math.round((localStorage.getItem('deutsch-app-state-v1') || '').length / 1024),
    };
  });
  results.push(summarise('cold load', await collect(page), paint.fcpMs));

  // Guard: if the welcome gate is still up, no tab exists and every scenario
  // below would silently measure an empty page.
  const gated = await page.getByRole('button', { name: /continue without/i }).count();
  if (gated > 0) throw new Error('bench: welcome gate is showing — seeding failed, aborting.');

  // ── Tab switches (first mount of each is the expensive one) ──
  for (const tab of ['Alphabet', 'Vocab', 'Translate', 'Stats', 'Chat']) {
    results.push(
      await measure(
        page,
        `tab → ${tab}`,
        tabLocator(page, tab),
        // the nav marks the live tab with aria-current; the label is an aria-label
        `document.querySelector('[aria-current="page"]')?.getAttribute('aria-label') === '${tab}'`
      )
    );
  }

  // ── Auto-deck: filters + sorts the whole lexicon index ───────
  await clickTab(page, 'Vocab');
  await page.waitForTimeout(1500);
  results.push(
    await measure(
      page,
      'select auto-deck (Top 500)',
      page.getByRole('button', { name: /Top 500/i }).first(),
      null,
      4000
    )
  );

  // ── Core game loop: answer one card ─────────────────────────
  const answer = page
    .getByRole('button')
    .filter({ hasNotText: /chat|alphabet|vocab|translate|stats|cards$|generate|sign in/i });
  const answerCount = await answer.count();
  if (answerCount === 0) throw new Error('bench: no answerable control found on the Vocab tab');
  results.push(
    await measure(page, 'answer a card', answer.nth(Math.min(4, answerCount - 1)), null, 1500)
  );

  // ── Bundle weight (what a first visit must parse) ────────────
  const bundle = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => /\.js$/.test(r.name))
      .reduce((a, r) => a + (r.decodedBodySize || 0), 0)
  );

  await browser.close();

  return {
    stateKB: paint.stateKB,
    fcpMs: paint.fcpMs,
    domInteractiveMs: paint.domInteractiveMs,
    jsBytesDecoded: bundle,
    scenarios: results,
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

async function main() {
  const passes = [];
  for (let i = 0; i < RUNS; i += 1) {
    process.stdout.write(`  run ${i + 1}/${RUNS}\r`);
    passes.push(await runOnce());
  }

  // Median each scenario independently — one slow pass should not skew a row.
  const labels = passes[0].scenarios.map((s) => s.label);
  const results = labels.map((label) => {
    const rows = passes.map((p) => p.scenarios.find((s) => s.label === label)).filter(Boolean);
    return {
      label,
      blockedMs: median(rows.map((r) => r.blockedMs)),
      tbtMs: median(rows.map((r) => r.tbtMs)),
      loafBlockingMs: median(rows.map((r) => r.loafBlockingMs)),
      longestTaskMs: median(rows.map((r) => r.longestTaskMs)),
      samples: rows.map((r) => r.blockedMs),
    };
  });

  const report = {
    base: BASE,
    cpuThrottle: CPU,
    account: ACCOUNT,
    runs: RUNS,
    stateKB: passes[0].stateKB,
    fcpMs: median(passes.map((p) => p.fcpMs)),
    domInteractiveMs: median(passes.map((p) => p.domInteractiveMs)),
    jsBytesDecoded: passes[0].jsBytesDecoded,
    scenarios: results,
    totalBlockedMs: results.reduce((a, r) => a + r.blockedMs, 0),
  };
  const bundle = report.jsBytesDecoded;

  const pad = (s, n) => String(s).padEnd(n);
  const num = (s, n) => String(s).padStart(n);
  console.log(
    `\nbench-perf · ${BASE} · CPU ${CPU}x · account=${ACCOUNT} (${report.stateKB}KB) · median of ${RUNS}`
  );
  console.log(`FCP ${report.fcpMs}ms · domInteractive ${report.domInteractiveMs}ms\n`);
  console.log(
    pad('scenario', 28) + num('blocked', 9) + num('TBT', 8) + num('LoAF', 8) + '   samples'
  );
  console.log('-'.repeat(68));
  for (const r of results) {
    console.log(
      pad(r.label, 28) +
        num(r.blockedMs + 'ms', 9) +
        num(r.tbtMs + 'ms', 8) +
        num(r.loafBlockingMs + 'ms', 8) +
        '   [' +
        r.samples.join(', ') +
        ']'
    );
  }
  console.log('-'.repeat(68));
  console.log(pad('TOTAL', 28) + num(report.totalBlockedMs + 'ms', 9) + '\n');

  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
    console.log(`baseline written to ${JSON_OUT}`);
  }

  if (COMPARE) {
    const base = JSON.parse(readFileSync(COMPARE, 'utf8'));
    const byLabel = new Map(base.scenarios.map((s) => [s.label, s]));
    let regressed = false;
    console.log(`comparing against ${COMPARE} (tolerance ${Math.round(TOLERANCE * 100)}%)\n`);
    for (const r of results) {
      const b = byLabel.get(r.label);
      if (!b) continue;
      const delta = r.blockedMs - b.blockedMs;
      // A fixed floor keeps sub-50ms noise from tripping the percentage check.
      const budget = Math.max(b.blockedMs * TOLERANCE, 50);
      const bad = delta > budget;
      if (bad) regressed = true;
      const sign = delta > 0 ? '+' : '';
      console.log(
        `${bad ? '✗' : '✓'} ${pad(r.label, 28)} ${num(b.blockedMs, 6)}ms → ${num(r.blockedMs, 6)}ms  (${sign}${delta}ms)`
      );
    }
    if (regressed) {
      console.log('\nregression detected');
      process.exit(1);
    }
    console.log('\nno regression');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
