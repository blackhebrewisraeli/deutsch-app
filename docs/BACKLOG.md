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

| Item                                                       | Notes                                                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **UI sub-project 1b** — grow the UI primitive set          | The `VocabTab.jsx` split shipped as #104 (807 → 325 lines, seven modules in `src/components/vocab/`)                                |
| **UI sub-project 2** — the Nocturne visual redesign proper | Moves light mode off parchment; layout and rhythm. T2 took the _depth_ slice early because the theme switch and bug sweep needed it |
| **UI sub-project 3** — graphics assets                     | Logo, icon set, empty/error states, OG image. The font slice shipped as #103                                                        |
| **Auth Phase E** — phone/SMS OTP                           | Deliberately deferred: the only auth component with a per-use cost                                                                  |

## Ready to execute

Nothing queued.

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

- **The contrast audit does not cover signed-in-only chrome** — AccountChip,
  freeze chip, leagues, ProfileCard. #125 fixed _which screen_ it audits (it was
  measuring the entry screen); it did not widen coverage. Needs a decision on
  whether to seed a real session.
- **`card.de` is read directly by seven components.** Recorded as an accepted
  exception in `AGENTS.md`, not a defect. Do not "fix" it.
