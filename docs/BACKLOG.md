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

| Item                                   | Notes                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| **UI sub-project 3** — graphics assets | Logo, icon set, empty/error states, OG image. The font slice shipped as #103 |
| **Auth Phase E** — phone/SMS OTP       | Deliberately deferred: the only auth component with a per-use cost           |

## Ready to execute

Nothing queued.

## Recently shipped

### UI sub-project 2 — the page skeleton

**Shipped as #179.** Design at
`docs/superpowers/specs/2026-08-28-ui-sub-project-2-layout-design.md`, plan at
`docs/superpowers/plans/2026-08-28-ui-sub-project-2-layout.md`.

`App.jsx`'s `<main>` and the six tabs now share one skeleton: `PageFrame`
decides the measure, both gutters and the safe-area composition in one place,
and the gap between a tab's `Hero` and its first block is `SPACE[8]` everywhere
it applies. Sub-project 1b's layout primitives finally have a real consumer —
before this, `PageFrame`, `Stack` and `Grid` had **zero**.

**Read the scope carefully before treating this as "the redesign done".** The
owner chose _consistency, not a new look_: the app should look as it did, on one
skeleton. The measured result was exactly that — a geometry probe over six tabs
× three widths found **three** differences in the whole app, all
`Alphabet.heroGap: 24 → 32`, which was the one stated intentional change. A
genuine visual redesign — new spacing scale, restructured screens, different
density — was **not attempted** and remains open work if anyone wants it.

Two decisions worth not re-deriving:

- **The measure stays 1400.** `PageFrame` shipped in 1b with a `maxWidth: 900`
  default that was a guess made with no consumer to check it against. Moving the
  app to it would have cut Chat's conversation column from 688px to 188px — the
  side columns are fixed, so the whole loss lands on the centre. The primitive
  moved to describe the app instead.
- **The bottom gutter is a plain value now — do not re-add an `env()` term.**
  `PageFrame` shipped in 1b with `paddingBottom: env(safe-area-inset-bottom, 0px)`,
  which is 0 on desktop, so adopting it naively would have silently removed 32px
  of clearance from every tab. Sub-project 2 first fixed that by _composing_ —
  `calc(gutter + env(...))`, so the inset could never replace the gutter. The
  review of that change then found the deeper problem: `index.html` has no
  `viewport-fit=cover`, so the inset resolved to 0 on every device anyway, and
  the whole term was inert. **#180 removed it**, and the test now asserts the
  bottom padding contains no `safe-area-inset` at all. Re-adding one is only
  correct alongside the `viewport-fit=cover` opt-in, which is a real visual
  change worth ~34px on notched iPhones.

**Known limits of the verification**, recorded so nobody reads more into it than
it proves. `scripts/dev/audit-layout.mjs` measures five properties — measure,
inline padding, bottom padding, the Hero gap, horizontal overflow — and nothing
else; colour, typography and z-order are outside it. All 18 rows are the **guest**
state, so Stats with real data, Vocab mid-drill and open modals are unmeasured.
`StatsTab` has **two** Heroes (Ligen at `:123`, Statistik at `:134`) and the probe
only ever reaches Statistik, so one of the app's six Heroes is never measured —
the rule already holds there, but the 18/18 denominator does not reveal the gap.

Downstream: the review of this work is what found the `viewport-fit=cover` gap
above. #180 then removed both inert declarations — `PageFrame`'s and an
`.entry-screen-foot` rule that no element in the app ever carried — and guards
the opt-in so the dead code cannot come back unnoticed.

### UI sub-project 1b — the primitive set

**Done.** Design at `docs/ui-primitives-spec.md`, plan at
`docs/superpowers/plans/2026-08-27-ui-primitives.md`, shipped as #166 (spec +
plan), #167–#173 (Tasks 1–7) and #176 (Task 8, alongside the toast close
button). `src/components/ui/` now holds twelve sources: the six that existed
plus `Heading`, `Text` (Body/Meta), `tone`, `Surface`, `InteractiveCard` and
`Layout` (Stack/Row/Grid/PageFrame).

Writing the spec against the code — rather than from first principles — is what
made this worth doing, because it turned up nine real defects that had nothing
to do with adding primitives:

- **`BUTTON.ghost` painted its label `COLORS.paper`**, the page-ground colour,
  so ghost text was invisible on any ground-coloured surface. It had zero
  consumers, which is exactly why no test had ever caught it.
- **Three hand-rolled `:focus-visible` recipes** with two different spellings,
  and no global rule at all — the other ~78 raw `<button>` elements had only the
  UA default.
- **The colour guard walked `.jsx` only** (five `.js` files under
  `src/components` were unscanned) and matched hex only, so `rgba()` and named
  colours sailed through.
- **`BUTTON.secondary` carried `flex: 1`** — a layout decision inside a colour
  token, which was stretching two buttons vertically in column containers.
- **`ui/Button` applied press styles after the caller's `style`**, so an
  override silently lost.
- **`GoogleButton` implemented busy as `disabled={busy}`** — on the component
  that carries `autoFocus` at two of its three call sites, so it dropped the
  user's focus to `<body>` at the moment they acted.
- **`FeedbackDialog` and `TutorialOverlay` never returned focus** to what opened
  them. Five of the seven dismissible surfaces already did.

Four guards now make the recurring structural mistakes unrepresentable rather
than remembered: colour literals in any notation, palette-layer imports inside
`ui/`, a bare `1fr` grid track, and a control nested inside an
`InteractiveCard`. Each was staged red against a fixture that could express the
failure before being trusted.

**The migration was deliberately NOT part of this.** Spec §12 makes it
opportunistic: new code uses the primitives, and a surface migrates when someone
is already editing it. So ~85 raw `<button>` elements and ~30 raw `fontSize`
literals remain on purpose — that is the policy, not an unfinished task. The two
exceptions were migrated: `UI.jsx`'s `Hero` / `SectionLabel` / `StatBlock` now
sit on the primitives (nine consumers, none of which needed a change), and the
three hand-rolled focus rings are gone.

### Known gap — the focus ring is invisible on ink-coloured planes

Spec §10.1 defines one ring, `2px solid COLORS.ink`. `COLORS.ink` is
`var(--c-fg)`, which is also the plane colour of every surface built on ink —
toasts, `CARD.dark`, the `accentBlack` masthead. Measured in a real browser, the
standard ring scores **1.00:1** against a toast in both modes: it is literally
the same colour. The paired ink scores 17.69:1 in light and 16.09:1 in dark.

`Toast`'s close button works around this with its own scoped rule using
`COLORS.paper`, and that is currently the only correct treatment in the app.
The spec should grow a dark-plane variant — probably a `data-focus-on-dark`
attribute the global sheet matches, so the workaround does not have to be
re-invented per component. Small, but it needs deciding before the next control
lands on a dark plane.

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

### Sentry source-map upload — needs a token only the account owner can mint

The build side is done and merged; it is dormant until this exists. Without it
Sentry shows minified stack traces, which is most of the way back to not having
the errors at all.

1. Sentry → **Settings → Auth Tokens → Create New Token**, scopes
   **`project:releases`** and **`org:read`**.
2. Vercel → project → **Settings → Environment Variables** → add
   **`SENTRY_AUTH_TOKEN`** to **Production and Preview**.
   - **Not** `VITE_SENTRY_AUTH_TOKEN`. Vite inlines every `VITE_*` var into the
     public bundle, so the prefix would publish a write-scoped credential.
3. Redeploy. Vite bakes build-time env at build time, so the variable alone
   changes nothing until a new build runs.

Verify it worked: the deploy's build log has no `SENTRY SOURCE-MAP UPLOAD
FAILED` banner, and the release in Sentry lists artifacts. A failed upload does
**not** fail the build — deliberately, so a Sentry outage cannot block a deploy
— which is exactly why the banner exists.

Note this widens the blast radius of a stored credential: unlike the read-only
token at `~/.config/deutsch-app/sentry-token`, this one can write. It lives only
in Vercel, never on disk in the repo.

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
- **The contrast gate covers header sheets and two modals, not every overlay.**
  Header sheets are DISCOVERED (`header button[aria-haspopup="dialog"]`); full
  modals are LISTED, because reaching one is an app state rather than a button
  in a fixed place — but each entry opens the modal itself and the run fails if
  it does not appear, so a modal that stops being reachable reports that rather
  than dropping out silently. Covered today: the sign-in sheet and the trial
  wall. `ProfileCard` is already reached by the signed-in pass. Not covered:
  `VitalsOverlay` (dev-only) and `AuthCallbackLanding` (a post-OAuth route,
  reachable only with a real callback URL). Add new overlays to `MODALS`.
- **League table rows are not keyboard reachable.** They are `<li onClick>` with
  no role, tabindex or key handler, so the profile card cannot be opened without
  a mouse. Found while writing the signed-in audit pass; flagged in
  `scripts/dev/audit-contrast.mjs` with a `// BUG:` rather than fixed there.
- **`card.de` is read directly by seven components.** Recorded as an accepted
  exception in `AGENTS.md`, not a defect. Do not "fix" it.
- ~~**`npm run audit:contrast` cannot complete locally, though CI runs it fine.**~~
  Closed: the script now provisions its own target. With no `AUDIT_BASE` it
  builds with stub Supabase config into `dist-audit/`, serves it, audits, and
  tears the server down — so `npm run audit:contrast` works on a developer box
  with a real `.env`, which it never did before. The cause was that a build
  carrying real `VITE_SUPABASE_*` rejects the seeded session the signed-in pass
  needs; CI passed only because it builds with stubs. Setting `AUDIT_BASE`
  still means "I am providing the server" and skips provisioning, which is the
  path CI takes. `AUDIT_SKIP_BUILD=1` reuses the last build and warns when
  `src/` is newer than it.

- ~~**The header-sheet layout check only covers the Appearance sheet.**~~
  Closed: the audit now DISCOVERS header sheets (`header
button[aria-haspopup="dialog"]`) instead of selecting one by its literal
  aria-label, drives each in turn, and colour-audits each one's interior while
  it is open — a closed sheet contributes no pairings, so the interiors were
  unaudited too. It also asserts its own coverage against `MIN_HEADER_SHEETS`
  and prints how many sheets it measured, because "0 findings" and "0 sheets
  checked" previously looked identical in the output. Proved with both
  controls: a deliberate clipping bug in the Status sheet is now caught across
  every mode/tone/viewport, and dropping a chip out of discovery fails the run
  with "expected at least 2 header sheets, found 1". AccountChip was brought
  into the same pattern afterwards — it had advertised `aria-haspopup="true"`
  (menu) over a panel with no role, so it was neither correct ARIA nor
  discoverable. Its sheet only exists with a session, so the floor is per-pass
  (2 guest / 3 signed-in) and the signed-in walk opens the sheets too.
  Opening it for the first time immediately found a real defect: the email line
  rendered at 1:1 in light mode, invisible, because the panel carried its own
  background but inherited the masthead's on-charcoal ink.
- **Local `.env` holds a Sentry user token where a DSN belongs.** The dev console
  logs `Invalid Sentry Dsn: sntryu_…` on every load. `sntryu_` is an auth-token
  prefix, not a DSN, so local error reporting is silently off. Production is
  unaffected (`VITE_SENTRY_DSN` is set correctly in Vercel and was verified
  inlined). Out of scope for the level-control work; it is a one-line local env
  fix, not a code change, which is why it is recorded here rather than patched.
