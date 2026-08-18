# Plan — `hasStoredLevel()` should mean "has a *valid* level"

**Status:** ✅ **SHIPPED** — implemented in #121 and #123, on `main` as of
2026-08-18. Kept as the record of the design; do not execute it again.
**Tier:** A — one behaviour change in one small module, plus tests.

> Promoted here from `CURSOR_TASKS.md`, which is git-excluded and therefore
> invisible to CI, Cursor Cloud, and any fresh checkout.
>
> A note on the timing, because it is the kind of thing that makes a plan
> dangerous later: when this was promoted (#127, main `01696fc`) the premise was
> re-verified and `hasStoredLevel()` genuinely was still
> `Boolean(localStorage.getItem(LEVEL_KEY))`. #121 and #123 landed in the
> interim and arrived in `main` in the same pull, so the plan was stale within
> the hour. The shipped code matches this design exactly — `resolveStored`,
> `Object.hasOwn` over `in`, and the legacy `beginner`/`intermediate` branch
> intact.

The design decision is already made and written out below. Do not redesign it.

## The problem

`src/lib/levelPref.js` has two functions that disagree about what counts as a
stored level:

| stored value | `hasStoredLevel()` | `readLevel()` |
|---|---|---|
| `a1` / `a2` / `b1` | true | that level |
| `beginner` / `intermediate` (legacy) | true | `a1` / `b1` |
| **`c2` or any junk** | **true** | **`a1`** |
| empty string / unset | false | `a1` |

`hasStoredLevel()` just asks "is the key non-empty". `App.jsx` seeds the level
picker from it (`useState(() => !hasStoredLevel())`), so a device holding a
corrupt value **skips the picker and silently lands on A1** — the user is never
asked, and never finds out why they are on A1.

This is not a regression; it is the behaviour #120 deliberately preserved. This
mission changes it on purpose.

## The change

`hasStoredLevel()` must return true only when the stored value actually
**resolves to a level** — the same notion of "resolvable" that `readLevel()`
already uses.

**⚠️ The trap — read this twice.** Legacy values (`beginner`, `intermediate`)
MUST still count as "has a level". They are not valid CEFR codes, so a naive
`LEVELS.includes(stored)` check would return false for them — and a user whose
device predates the CEFR codes would be re-asked for a level they already chose,
every visit, even though `readLevel()` resolves their value perfectly well. If
your implementation makes `hasStoredLevel('beginner')` false, it is wrong.

Extract one shared resolver so the two functions cannot drift apart, and have
both call it:

```js
/**
 * Map a raw stored value to a level, or null when it is not one.
 * Legacy values resolve; anything else does not. Single source of truth for
 * "is this a level?" so readLevel and hasStoredLevel cannot disagree.
 * @param {string | null} stored
 * @returns {'a1' | 'a2' | 'b1' | null}
 */
function resolveStored(stored) {
  if (LEVELS.includes(stored)) return stored;
  if (Object.hasOwn(LEGACY, stored)) return LEGACY[stored];
  return null;
}
```

Then rewrite the two exported functions in terms of it:

```js
export function readLevel() {
  try {
    return resolveStored(localStorage.getItem(LEVEL_KEY)) ?? 'a1';
  } catch {
    // private mode / blocked storage
  }
  return 'a1';
}

export function hasStoredLevel() {
  try {
    return resolveStored(localStorage.getItem(LEVEL_KEY)) !== null;
  } catch {
    return false;
  }
}
```

Keep `Object.hasOwn`, not `in` — `in` walks the prototype chain, so a stored
value of `"constructor"` or `"toString"` would resolve to an `Object.prototype`
function instead of falling through. That was fixed once already; do not
reintroduce it.

Update `hasStoredLevel`'s JSDoc to say it means a *valid* level.

**`readLevel()`'s public behaviour must not change at all.** Same inputs, same
outputs, including `a1` for unset, corrupt, empty and blocked storage. It is a
refactor there and a behaviour change only in `hasStoredLevel`.

## Tests

Add to `src/lib/levelPref.test.js`:

```js
it.each([
  ['a1', true],
  ['a2', true],
  ['b1', true],
  ['beginner', true],
  ['intermediate', true],
  ['c2', false],
  ['', false],
  ['constructor', false],
])('hasStoredLevel(%s) is %s', (stored, expected) => {
  localStorage.setItem('deutsch-level', stored);
  expect(hasStoredLevel()).toBe(expected);
});

it('reports no stored level when nothing is stored', () => {
  expect(hasStoredLevel()).toBe(false);
});

it('reports no stored level when storage is blocked', () => {
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('SecurityError');
  });
  expect(hasStoredLevel()).toBe(false);
  spy.mockRestore();
});
```

Add `hasStoredLevel` to that file's import line if it is not already there.

Then the user-visible half, in `src/App.test.jsx`, inside the existing
`describe('entry gate', …)` block so you inherit its `authMock` and `beforeEach`:

```js
it('asks for a level again when the stored one is corrupt', () => {
  authMock.configured = false; // no gate, so the splash is what renders
  localStorage.setItem('deutsch-level', 'c2');
  render(<App />);
  expect(screen.getByRole('button', { name: /Beginner \(A1\)/ })).toBeInTheDocument();
});
```

Note the splash's buttons read `🌱 Beginner (A1)` — match on the regex above,
not on `A1` alone, which would also match the settings picker.

## Prove each test can fail

Before committing, break the thing and watch it fail, then restore:

1. Make `hasStoredLevel` return `Boolean(localStorage.getItem(LEVEL_KEY))` again
   → the `c2` and `constructor` cases and the App test must fail.
2. Make `resolveStored` check only `LEVELS.includes(stored)` (dropping the
   legacy branch) → the `beginner` and `intermediate` cases must fail.

**Step 2 is the one that matters** — it is the trap this mission is built
around. If your tests still pass with the legacy branch removed, your tests do
not cover the trap and you must fix the tests, not the code. Report what you saw
for both.

## Explicitly NOT in this mission

- Do not change `writeLevel`, `LEVEL_NAMES`, `LEVELS`, or `LEVEL_KEY`.
- Do not touch `sync.js`, `StatsTab`, `SplashScreen`, or any CSS.
- Do not rename any storage key (forbidden repo-wide — see AGENTS.md).
- Do not add a migration that rewrites corrupt values. Showing the picker is the
  fix; silently repairing storage is a different decision and is not yours.

## Verification

```
npm test
npm run lint
npm run format:check
```

Baseline entering this mission is **1468 tests**. Expect around 1478 — the exact
count depends on how `it.each` expands; state the number you land on. No
existing test should need changing. **If one does, stop and report it** — it
means the behaviour change reached further than this brief predicted, which is
information Claude Code needs before merge.

## Done when

- `hasStoredLevel()` is true for the three CEFR codes and both legacy values,
  false for junk, empty, unset and blocked storage.
- `readLevel()` behaves exactly as before.
- Both mutations above were observed failing, and you say so in the report.
- One branch, one PR against `main`, opened as a **draft**.

## Landing

Open the PR as a draft. Do not merge — Claude Code reviews first.

---
