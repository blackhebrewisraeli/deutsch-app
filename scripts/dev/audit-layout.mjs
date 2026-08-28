/**
 * Geometry probe for UI sub-project 2.
 *
 * Records the page skeleton's measurable properties for every tab at every
 * width, so "nothing moved" is a diff of numbers rather than an opinion.
 * Run it before the change and after; diff the two JSON outputs.
 *
 *   npm run build
 *   npx vite preview --port 5290 --strictPort &
 *   AUDIT_BASE=http://localhost:5290 npm run --silent audit:layout > before.json
 *
 * The --silent flag is not optional: without it, npm prints its own
 * "> pkg@ver audit:layout" banner to STDOUT ahead of the JSON, which breaks
 * JSON.parse on the captured file. Confirmed on npm 11.11.1.
 *
 * AUDIT_BASE is required. audit-contrast.mjs can provision its own server, but
 * that is ~200 lines this probe does not need, and its helpers are not exported
 * — refactoring a working CI gate to share them is risk for no gain here.
 *
 * What this DOES NOT verify: colour, typography, z-order, or anything visual
 * outside the five measurements below. That limit is deliberate and recorded in
 * the spec (§7); it is the trade taken to avoid committing screenshot baselines.
 */
import { chromium } from 'playwright';

const BASE = process.env.AUDIT_BASE;
if (!BASE) {
  console.error('audit-layout: set AUDIT_BASE to a running production build, e.g.');
  console.error('  npm run build && npx vite preview --port 5290 --strictPort &');
  console.error('  AUDIT_BASE=http://localhost:5290 npm run audit:layout');
  process.exit(2);
}

const TABS = ['Home', 'Chat', 'Alphabet', 'Vocab', 'Translate', 'Stats'];

// 1600, not 1400: `max-width: 1400` never constrains at a 1400px viewport, so
// the measure — the property this whole sub-project turns on — would be the one
// thing left unverified.
const WIDTHS = [320, 375, 1600];

/** Click through the welcome gate. */
async function dismissEntryScreens(page) {
  // `[data-entry="guest"]`, not a styling class: the previous selector was
  // `.welcome-guest`, which existed only to carry a scoped :focus-visible rule
  // and vanished when that rule moved to the global sheet.
  const gate = await page.$('[data-entry="guest"]');
  if (gate) {
    await gate.click();
    await page.waitForTimeout(200);
  }
  const onShell = await page.evaluate(() => Boolean(document.querySelector('header')));
  if (!onShell) {
    throw new Error('audit-layout: never reached the app shell — the entry flow changed.');
  }
}

/**
 * Switch tabs by the nav button's accessible name, and verify the switch
 * actually happened.
 *
 * A silent no-op here (label drifted, wrapping span ate the textContent) would
 * otherwise leave the PREVIOUS tab active while this function returns clean —
 * the sweep would still emit 18/18 rows and exit 0, having measured one tab
 * six times under six different labels. Row count can't catch that; only
 * checking the DOM after the click can.
 */
async function openTab(page, tab) {
  const clicked = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      new RegExp(`^\\s*${t}\\s*$`, 'i').test(x.getAttribute('aria-label') || x.textContent || '')
    );
    if (!b) return false;
    b.click();
    return true;
  }, tab);
  if (!clicked) {
    throw new Error(`audit-layout: no nav button matched tab "${tab}" — the accessible name may have drifted`);
  }
  await page.waitForTimeout(500);

  // The active nav button carries aria-current="page" (src/App.jsx:
  // `aria-current={active ? 'page' : undefined}`) — the one signal on the
  // button itself that distinguishes "this is the selected tab" from "this is
  // just a button that exists". Confirm the click actually landed there.
  const landed = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      new RegExp(`^\\s*${t}\\s*$`, 'i').test(x.getAttribute('aria-label') || x.textContent || '')
    );
    return b?.getAttribute('aria-current') === 'page';
  }, tab);
  if (!landed) {
    throw new Error(`audit-layout: clicked "${tab}" but it never became the active tab (aria-current)`);
  }
}

/**
 * Runs in the page. Reads the five properties the spec names.
 *
 * The Hero gap is measured as a RENDERED distance (next block's top minus the
 * Hero's bottom) rather than by reading marginTop. The rendered number is what
 * a user sees, and it stays correct if the spacing later moves to a flex gap.
 */
function measureLayout() {
  const main = document.querySelector('main');
  if (!main) return { error: 'no <main> element' };
  const cs = getComputedStyle(main);
  const doc = document.documentElement;

  let heroGap = null;
  const h1 = main.querySelector('h1');
  if (h1) {
    const heroRoot = h1.parentElement;
    const next = heroRoot?.nextElementSibling;
    if (next) {
      heroGap = Math.round(
        next.getBoundingClientRect().top - heroRoot.getBoundingClientRect().bottom
      );
    }
  }

  return {
    maxWidth: cs.maxWidth,
    clientWidth: main.clientWidth,
    padTop: cs.paddingTop,
    padLeft: cs.paddingLeft,
    padRight: cs.paddingRight,
    padBottom: cs.paddingBottom,
    heroGap,
    overflow: doc.scrollWidth - doc.clientWidth,
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const rows = [];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await dismissEntryScreens(page);
    for (const tab of TABS) {
      await openTab(page, tab);
      const m = await page.evaluate(measureLayout);
      rows.push({ tab, width, ...m });
    }
  }

  await browser.close();

  // The denominator. "0 differences" and "visited 0 tabs" print identically
  // without it, and a probe that silently reached nothing would read as success.
  const expected = TABS.length * WIDTHS.length;
  console.error(`audit-layout: measured ${rows.length}/${expected} (tab × width) combinations`);
  if (rows.length !== expected) {
    console.error('audit-layout: incomplete sweep');
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
