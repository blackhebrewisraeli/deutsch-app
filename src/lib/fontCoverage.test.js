import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { activePack } from '../packs/index';
import { familySlug } from './injectFonts';

// Guards the vendored fonts against the text the app actually renders.
//
// The naive form of this test — "every shipped codepoint is covered" — cannot
// pass and should not: the authored content contains emoji (👋 🍞 ✈) and
// Tatoeba example sentences contain mathematical alphanumerics (𝐾 = 𝑚𝑏) and
// set notation (⊂). No text font carries those; they fall back to a system
// face and always have.
//
// The question worth asking is narrower and has a right answer: *was this
// glyph on offer, and did we drop it?* Google splits each family into subsets;
// the pack picks some, and `npm run vendor:fonts` records the ranges of the
// ones it skipped. A shipped codepoint landing inside a skipped range means a
// subset that is carrying real content got dropped — which is how restricting
// the mono face to latin+latin-ext silently downgraded IPA's θ and χ during
// this mission, before the greek subset was added back.
//
// vitest runs from the repo root, so repo-relative paths resolve here.

const FONT_DIR = 'public/fonts';
const LEXICON_DIR = 'public/lexicon/de';

const manifest = JSON.parse(readFileSync(`${FONT_DIR}/manifest.json`, 'utf8'));

/** Parse `unicode-range: U+0-FF, U+2192;` descriptors into [lo, hi] pairs. */
function parseRanges(text) {
  const ranges = [];
  for (const m of text.matchAll(/unicode-range:\s*([^;]+);/gi)) ranges.push(...tokens(m[1]));
  return ranges;
}

function tokens(list) {
  const out = [];
  for (const token of list.split(',')) {
    const t = token.trim().replace(/^u\+/i, '');
    if (!t) continue;
    if (t.includes('?')) {
      // Wildcard form, e.g. U+04??. Google does not emit it today, but the spec
      // allows it and mis-parsing it would overstate coverage.
      out.push([parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'F'), 16)]);
    } else if (t.includes('-')) {
      const [lo, hi] = t.split('-');
      out.push([parseInt(lo, 16), parseInt(hi, 16)]);
    } else {
      out.push([parseInt(t, 16), parseInt(t, 16)]);
    }
  }
  return out;
}

const covers = (ranges, cp) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
const show = (cp) =>
  `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${String.fromCodePoint(cp)}`;

/** Every string reachable in a value, however nested. */
function* strings(value, depth = 0) {
  if (depth > 8 || value == null) return;
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const v of value) yield* strings(v, depth + 1);
  else if (typeof value === 'object')
    for (const v of Object.values(value)) yield* strings(v, depth + 1);
}

// Whitespace and C1 controls are never rendered as glyphs.
const rendered = (cp) => cp > 0x20 && !(cp >= 0x7f && cp <= 0x9f);

/** codepoint → an example string containing it. */
function codepoints(iterable) {
  const seen = new Map();
  for (const s of iterable) {
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (rendered(cp) && !seen.has(cp)) seen.set(cp, s);
    }
  }
  return seen;
}

function lexicon() {
  const files = readdirSync(LEXICON_DIR).filter((f) => /^chunk-\d+\.json$/.test(f));
  expect(files.length).toBeGreaterThan(0);
  return files.map((f) => JSON.parse(readFileSync(`${LEXICON_DIR}/${f}`, 'utf8')));
}

describe('vendored fonts', () => {
  const families = activePack.theme.font.families;

  it('vendored every family the pack declares, with its licence', () => {
    for (const family of families) {
      const dir = `${FONT_DIR}/${familySlug(family.name)}`;
      expect(
        existsSync(`${dir}/face.css`),
        `${dir}/face.css missing — run npm run vendor:fonts`
      ).toBe(true);
      // Self-hosting makes us the redistributor; OFL 1.1 allows that only if
      // the licence travels with the files.
      expect(existsSync(`${dir}/OFL.txt`), `${dir}/OFL.txt missing`).toBe(true);
    }
  });

  it('every woff2 the stylesheets reference exists on disk', () => {
    // The failure this catches is a half-written public/fonts: a download that
    // 404s mid-run once left one family vendored and the other with none.
    for (const family of families) {
      const slug = familySlug(family.name);
      const refs = [
        ...readFileSync(`${FONT_DIR}/${slug}/face.css`, 'utf8').matchAll(/url\(([^)]+)\)/g),
      ].map((m) => m[1].trim());
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(ref.startsWith('/fonts/'), `${ref} is not a local path`).toBe(true);
        expect(existsSync(`public${ref}`), `${ref} referenced but not vendored`).toBe(true);
      }
    }
  });

  it('reaches no third-party host', () => {
    for (const family of families) {
      const css = readFileSync(`${FONT_DIR}/${familySlug(family.name)}/face.css`, 'utf8');
      expect(css).not.toContain('gstatic.com');
      expect(css).not.toContain('googleapis.com');
    }
  });
});

describe('no dropped subset is carrying content', () => {
  // A codepoint counts as lost only if a skipped subset covered it and no kept
  // subset does. Google's subsets overlap: U+0329 (the syllabic mark under
  // /ɡəˈɡeːbn̩/) is listed by both `latin` and `vietnamese`, so testing
  // membership of the skipped ranges alone reports it as dropped when the
  // shipped latin file has it. Subtracting what is kept is what makes the
  // difference between a real regression and noise.
  const lost = Object.fromEntries(
    Object.entries(manifest.families).map(([name, f]) => {
      const kept = parseRanges(readFileSync(`${FONT_DIR}/${f.slug}/face.css`, 'utf8'));
      const gone = f.skipped.flatMap((s) => tokens(s.unicodeRange));
      return [name, (cp) => covers(gone, cp) && !covers(kept, cp)];
    })
  );

  const bodyFamily = activePack.theme.font.families[0].name;
  // VocabTab renders every card's pronunciation with FONTS.mono, so IPA is the
  // mono face's content, not the body face's.
  const monoFamily = activePack.theme.font.families[1].name;

  it('the manifest records skipped subsets to check against', () => {
    // Guards the guard: if `skipped` were empty the assertions below would
    // pass vacuously no matter what got dropped.
    expect(Object.keys(lost)).toContain(bodyFamily);
    // A glyph in a skipped subset and in no kept one must be detectable, or
    // every assertion below passes no matter what got dropped. U+0400 (Ѐ) is
    // cyrillic, which neither family ships.
    expect(lost[monoFamily](0x0400)).toBe(true);
    expect(lost[monoFamily]('a'.codePointAt(0))).toBe(false);
    expect(
      parseRanges(readFileSync(`${FONT_DIR}/fraunces/face.css`, 'utf8')).length
    ).toBeGreaterThan(10);
  });

  it('the body face keeps every subset the authored content needs', () => {
    const found = codepoints(strings(activePack.content));
    expect(found.size).toBeGreaterThan(40);
    const dropped = [...found].filter(([cp]) => lost[bodyFamily](cp));
    expect(dropped.map(([cp, ex]) => `${show(cp)} in ${JSON.stringify(ex.slice(0, 60))}`)).toEqual(
      []
    );
  });

  it('the body face keeps every subset the lexicon headwords and glosses need', () => {
    const entries = lexicon().flatMap((chunk) => Object.values(chunk));
    const found = codepoints(
      (function* () {
        for (const e of entries) {
          if (e.de) yield e.de;
          for (const g of [].concat(e.en ?? [])) yield g;
          for (const ex of e.examples ?? []) yield `${ex.de ?? ''} ${ex.en ?? ''}`;
        }
      })()
    );
    expect(found.size).toBeGreaterThan(40);
    const dropped = [...found].filter(([cp]) => lost[bodyFamily](cp));
    expect(dropped.map(([cp, ex]) => `${show(cp)} in ${JSON.stringify(ex.slice(0, 60))}`)).toEqual(
      []
    );
  });

  it('the mono face keeps the greek subset that IPA borrows θ and χ from', () => {
    const entries = lexicon().flatMap((chunk) => Object.values(chunk));
    const found = codepoints(
      (function* () {
        for (const e of entries) if (e.ipa) yield e.ipa;
      })()
    );
    expect(found.size).toBeGreaterThan(40);
    const dropped = [...found].filter(([cp]) => lost[monoFamily](cp));
    expect(dropped.map(([cp, ex]) => `${show(cp)} in ${JSON.stringify(ex.slice(0, 60))}`)).toEqual(
      []
    );
  });
});
