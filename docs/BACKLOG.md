# Backlog — deliberately-not-started work, and what needs a human

**Why this file is tracked.** The working queue lives in `CURSOR_TASKS.md`, which
is git-excluded (`.git/info/exclude`) and therefore exists on one machine only —
invisible to CI, to Cursor Cloud, and to a fresh checkout. Anything in it that
governs _future_ work rather than one mission belongs here instead, where it
follows the project. `CURSOR_TASKS.md` stays the scratch queue for in-flight
mission briefs; this file is the durable half.

Product decisions that constrain the architecture live in **`AGENTS.md`**, not
here — see the German-only decision under **Project** there.

---

## Blocked — needs a Claude Code spec + plan before anyone starts

Starting these without a written design means the implementing agent invents the
architecture, which is the expensive thing to undo. That is the whole reason
they are listed as blocked rather than "available".

| Item                                                       | Notes                                                                                                                                                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UI sub-project 1b** — grow the UI primitive set          | The `VocabTab.jsx` split shipped as #104 (807 → 325 lines, seven modules in `src/components/vocab/`)                                                                                               |
| **UI sub-project 2** — the Nocturne visual redesign proper | Layout and rhythm. Two slices are already out: T2 took _depth_ early, and the ivory re-skin took _light mode off parchment_ (see "Recently shipped"). What remains here is composition, not colour |
| **UI sub-project 3** — graphics assets                     | Logo, icon set, empty/error states, OG image. The font slice shipped as #103                                                                                                                       |
| **Auth Phase E** — phone/SMS OTP                           | Deliberately deferred: the only auth component with a per-use cost                                                                                                                                 |

## Ready to execute

Nothing queued.

## Recently shipped

### The charcoal masthead — `accentBlack`'s consumer

The masthead landed: the header is `COLORS.accentBlack` in both modes, carrying
the splash's black stripe into the app frame, with the wordmark on
`accentBlackOn` and its dot on `COLORS.flagRed` — the same token the splash
paints it with.

The design rule that made it cheap is worth keeping, because the obvious
approach does not work: **on the masthead, only brand text sits on the charcoal;
anything informational carries its own surface.** Painting the bar and re-inking
each control would have needed a mode-independent copy of every ring colour —
the XP arc falls to 2.21:1 on charcoal in light.night, the goal ring's red to
2.44:1. Giving `LevelBadge` and `GoalRing` a `surface` disc instead keeps every
already-audited pairing valid and adds no colour tokens. `StatBlock` and
`ThemeChip` needed no change at all: they already carried their own surfaces,
which is what suggested the rule.

One token was added — `accentBlackOnMuted` — because the tagline had nothing to
use: `fg-muted` is a dark brown in light mode. It is opaque rather than
`accentBlackOn` at alpha so `contrast.test.js` can assert it; alpha tokens are
excluded from that sweep and would go unchecked.

## Retired rather than left unused

Two tokens shipped in #131 and were deleted before gaining a consumer, which is
recorded here so nobody re-adds them reasoning from first principles:

- **`accentGold`** — `COLORS.gold` (the pack accent) already carries reward,
  streak, XP and level-up. A second gold had no rule to distinguish it.
- **`borderSubtle`** — in-card dividers use `COLORS.inkA10`/`inkA12`, ink at
  10-12% alpha, which composites correctly on every surface including the
  derived elevation steps. An opaque token cannot, so adopting it would have
  been a regression.

`COLORS.accentAlt` has sat unused since the theme arc began. One unused accent
in a palette is a rounding error; four is how a palette stops being trustworthy.

## Decided but not adopted — the body sans

**A sans body face is vendored and one line from shipping, deliberately unflipped.**

`AGENTS.md` fixes the typography — Fraunces for display, JetBrains Mono for
uppercase labels — and body copy currently renders in Fraunces too. Plus Jakarta
Sans (47.8 KB, `latin` + `latin-ext`) is vendored into `public/fonts/` and
exported as `BODY_SANS` from `src/packs/de/theme.js`. Adopting it means setting
`body: BODY_SANS` in that file's `font` object **and amending the AGENTS.md
typography rule in the same change**, because the rule as written forbids it.

Recorded here rather than left in `CURSOR_TASKS.md` because it governs future
work: the next agent to read the AGENTS.md rule needs to know the family is
already paid for, and that the remaining cost is a brand decision, not an
implementation.

The tradeoff, so it does not need re-deriving: Fraunces is a display serif with
an `opsz` axis, and it is doing double duty as body copy at 13–15px, where its
contrast modulation is what makes long prose feel dense. A sans would loosen
paragraph texture in chat and exercise copy. It would also make the display
headings read as _deliberate_ rather than as the default, which is the actual
argument for the change.

Recently shipped: **`hasStoredLevel()` now means "has a _valid_ level"** (#121,
#123) — a device holding a corrupt level value used to skip the picker and
silently land on A1. Design kept at
`docs/superpowers/plans/2026-08-18-level-pref-validation.md`.

---

## Owner actions — nobody with repo access can do these

Each needs the Supabase or Google Cloud dashboard. Neither Claude Code nor Cursor
can complete or, in most cases, verify them; status below says how each was
checked so a stale entry is obvious.

| #   | Action                                                                                                                                                                                 | Status                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Paste `supabase/templates/magic_link.html` into the **hosted** project → Authentication → Email Templates → Magic Link. Local GoTrue reads it from `config.toml`; production does not. | **Unverified from the repo** — hosted dashboard state. Procedure: `docs/AUTH_EMAIL_TEMPLATE_RUNBOOK.md`                                |
| 2   | Confirm hosted **URL Configuration** lists production plus `http://localhost:5173` and `http://127.0.0.1:5173`.                                                                        | **Unverified from the repo** — hosted dashboard state                                                                                  |
| 3   | Google OAuth client → Supabase Google provider → `VITE_GOOGLE_AUTH_ENABLED=true` on Preview + Production, **then redeploy**.                                                           | ✅ **Done** — flag present in the production env, Google sign-in live since 2026-08-17. Procedure: `docs/AUTH_GOOGLE_OAUTH_RUNBOOK.md` |

Two traps worth keeping, both from #96:

- The redirect URI is **Supabase's** `/auth/v1/callback`, not the app origin.
  That is the step people get wrong.
- Vite inlines env at **build** time, so flipping a `VITE_*` flag changes nothing
  until a redeploy.

---

## Known gaps, recorded rather than fixed

- ~~**The contrast audit does not cover signed-in-only chrome.**~~ Closed: the
  audit now runs a signed-in pass (2 modes x 2 tones) over the AccountChip, the
  Stats account section, the league table and the profile card, using a seeded
  session and stubbed league responses. The freeze chip named in the original
  entry was never actually a gap — the existing seed yields two freezes, so the
  guest walk already rendered it.
- **League table rows are not keyboard reachable.** They are `<li onClick>` with
  no role, tabindex or key handler, so the profile card cannot be opened without
  a mouse. Found while writing the signed-in audit pass; flagged in
  `scripts/dev/audit-contrast.mjs` with a `// BUG:` rather than fixed there.
- **`card.de` is read directly by seven components.** Recorded as an accepted
  exception in `AGENTS.md`, not a defect. Do not "fix" it.
