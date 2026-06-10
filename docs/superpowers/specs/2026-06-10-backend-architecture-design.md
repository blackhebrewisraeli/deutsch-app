# Backend Architecture — Separating the User Interface from the Developer Interface

**Date:** 2026-06-10
**Status:** Approved design (brainstormed and user-approved in session).
Implementation is phased **B0–B4** below; each phase gets its own spec/plan
before any code is written.
**Relationship:** Backend counterpart to
`2026-06-09-multi-language-platform-design.md`. That note governs the
content/engine layering (packs, themes, Phases 0–4); this one governs
everything across the network boundary. Where the two touch (storage
namespacing, prompts, card identity) the interlocks are called out explicitly.

---

## Decision summary

| Decision | Choice | Rationale (short) |
|---|---|---|
| Meaning of "developer interface" | The API surface + database schema/RLS contract | User decision |
| Backend scope (this arc) | AI service layer · accounts + progress sync · pack-delivery contract | Telemetry/BigQuery deliberately deferred to a later arc |
| Identity model | Anonymous-first, optional account | Keeps the PWA frictionless; sync is a feature, not a gate |
| Data platform | Supabase (Postgres + Auth) | Anonymous→linked auth is built in; relational fit for SRS data; RLS; free tier; matches owner's installed tooling (Postgres.app, DataGrip, Docker). BigQuery is an analytics warehouse, not an app DB — it stays parked for the telemetry arc |
| Architecture | Hybrid, two lanes ("Approach A") | Best on both security and efficiency — see Appendix A for the comparison against the rejected approaches |
| Hosting | Vercel stays (serverless functions) | Existing GitHub integration; no new operational platform |

---

## The two interfaces

**User interface** — the React PWA exactly as it exists: components over the
language-blind engine (`src/lib/*`), with `localStorage` as the offline source
of truth. The client bundle contains **no credentials** beyond the Supabase
anon key, which is public by design.

**Developer interface** — two documented, versioned contracts living below the
trust boundary:

1. **REST surface** — `/api/v1/*` Vercel serverless functions. Contract
   reference lives in `docs/api/` (one markdown page per endpoint group:
   request/response shapes, error codes, rate limits).
2. **Data contract** — the Postgres schema + RLS policies, expressed as
   versioned SQL migrations in `supabase/migrations/`.

**Governing rule:** secrets exist only below the trust boundary. The browser
never holds the Anthropic key or the Supabase service-role key, in any
environment, including dev.

---

## Lane 1 — AI service (`/api/v1/ai/*`)

Today's single proxy (`api/chat.js`) becomes three versioned endpoints sharing
one middleware chain:

- `POST /api/v1/ai/chat` — Anna conversation turns
- `POST /api/v1/ai/grade` — answer/translation grading
- `POST /api/v1/ai/deck` — custom deck generation

**v1 request contract** is the current shape (`model`, `system`, `messages`,
`max_tokens`), validated and capped as today. Prompts remain **client-assembled
and pack-owned** (platform-spec Phase 1.3 moves them behind `pack.prompts`);
the lane validates and caps but does not own prompt content. Splitting per
feature now buys per-feature rate quotas and the option to move prompt
assembly server-side later **without a breaking change**.

**Middleware chain** (shared helpers in `api/_lib/` — underscore-prefixed
paths are not deployed as routes by Vercel):

1. Method check (`POST` only).
2. Origin allow-list — **mandatory in production**: `ALLOWED_ORIGINS` is set in
   Vercel env (`https://deutsch-app-dusky.vercel.app`, plus any future custom
   domain). Same semantics as today: a present-but-unlisted `Origin` is
   rejected; absent `Origin` passes (rate limiting is the real control).
3. Schema validation — model allow-list, `max_tokens` cap, message count/size
   caps (carried over from the current handler).
4. Rate limiting — per identity: by Supabase user id when a valid JWT
   accompanies the request, else by IP. Counters live in a Supabase
   `rate_limits` table (no new vendor; swap to Upstash only if scale demands).
   Initial quotas, tunable in the B0 plan: chat **20 req / 5 min**, grade
   **60 / 5 min**, deck **5 / hour**. Exceeding returns `429` with
   `Retry-After`.
5. Forward a **rebuilt clean body** to Anthropic (as today), translate
   failures into the shared error envelope.

**Secret rename (resolves the current docs/code mismatch):** the function reads
`ANTHROPIC_API_KEY`, matching AGENTS.md. The `VITE_ANTHROPIC_API_KEY` name
dies. Going forward the `VITE_` prefix is reserved for **public-by-design**
values only (see Cross-cutting).

**Dev story:** retire the Vite proxy in `vite.config.js` (and with it the
`anthropic-dangerous-direct-browser-access` header). Local dev runs
`vercel dev`, which serves the real functions next to the Vite app, so dev and
prod exercise the same code path.

**PWA compatibility shim:** deployed service workers have cached bundles that
call `/api/chat` for a while after release. `api/chat.js` stays as a thin
forwarder to the v1 chat handler during a deprecation window; remove it one
release cycle later (decision point recorded in the B0 plan).

---

## Lane 2 — Identity & data (Supabase)

### Identity

- **Lazy anonymous identity:** no Supabase user exists until the person does
  something sync-worthy (enables sync / taps sign-in). Then
  `signInAnonymously()` creates an invisible session. (Supabase project
  setting "allow anonymous sign-ins" must be enabled; Supabase's built-in
  auth rate limits apply.)
- **Account linking:** Google OAuth + email magic link (initial provider set).
  Two precisely distinct paths:
  - **Path 1 — Link (common):** the anonymous user gains credentials via
    `linkIdentity()`. The `user_id` is unchanged → **zero data movement**.
  - **Path 2 — Sign into an existing account** (user already has an account
    from another device): local/anonymous rows are merged into the existing
    account by a server function `POST /api/v1/account/merge`
    (service-role, transactional), then the orphaned anonymous user is
    deleted. Merge uses the same per-record rules as sync (below).

### Schema (mirrors the current localStorage shape)

All user tables carry `pack_id text not null default 'de'` **from day one** —
the platform spec's Phase 4 (per-language namespacing) then needs no server
migration.

| Table | Key columns | PK |
|---|---|---|
| `profiles` | `user_id → auth.users`, `created_at`, `display_name?` | `user_id` |
| `srs_state` | `user_id, pack_id, card_id, due_at, interval, ease, reps, lapses, updated_at` | `(user_id, pack_id, card_id)` |
| `stats_daily` | `user_id, pack_id, day, counters jsonb, updated_at` | `(user_id, pack_id, day)` |
| `decks` | `user_id, pack_id, deck_id, name, cards jsonb, updated_at` | `(user_id, pack_id, deck_id)` |
| `settings` | `user_id, data jsonb, updated_at` (global per user) | `user_id` |
| `rate_limits` | `key, window_start, count` | `key` |

`card_id` is the **language-neutral card identity** introduced by platform
Phase 1.1 (Cursor mission A6) — sync keys on `card.id`, never on a German
surface form. **B2 therefore depends on A6 being merged.**

### RLS (the authorization layer)

- Every user table: RLS **enabled**, policies `user_id = auth.uid()` for
  select/insert/update/delete.
- `rate_limits`: RLS enabled with **no policies** → invisible to clients;
  server functions access it via the service-role key.
- Migrations are written so RLS-on is part of table creation, never a
  follow-up statement.

### Sync engine (`src/lib/sync.js` — engine module, language-blind)

- Feature-flagged until B3 completes.
- `localStorage` stays the **source of truth offline**; existing storage keys
  are untouched (AGENTS.md constraint — renaming/namespacing is platform
  Phase 4).
- Outbound: debounced queue pushes dirty records upward when a session exists.
- Inbound: pull on app start (and on `visibilitychange` resume) when a session
  exists.
- **Merge rules:** last-write-wins per record via `updated_at` for decks,
  settings, stats; SRS cards prefer the record with the **more recent last
  review**. Exact SRS tie-breaks are finalized in the B2 sub-spec.
- Offline or signed-out: the engine is a no-op; the app behaves exactly as
  today.

### Privacy

The only PII is the email on a linked account. `GET /api/v1/account/export`
and `DELETE /api/v1/account` ship in **B3** with account linking, so account
features and data-rights hygiene land together.

---

## Lane 3 — Pack delivery (contract now, code at pack #2)

- Reserved contract, documented in `docs/api/` from B0:
  - `GET /api/v1/packs` → `[{ id, name, nativeName, version }]`
  - `GET /api/v1/packs/:id` → pack manifest + content
- Packs remain **bundled in the build** until a second language pack exists —
  the same YAGNI stance as the platform spec. Pack validation stays where it
  is (`src/packs/validate.js`, enforced in CI).

---

## Cross-cutting conventions

- **Error envelope** (every non-2xx from our functions):
  `{ "error": { "code": "<machine_code>", "message": "<human text>" } }` with
  codes `bad_request · unauthorized · rate_limited · upstream_error ·
  server_error`.
- **Versioning:** breaking changes mean `/api/v2/...`; `/v1` contracts stay
  stable once shipped.
- **Env & secrets inventory** (single source of truth for names):

| Name | Where it lives | Public? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel env → functions only | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env → functions only | No |
| `ALLOWED_ORIGINS` | Vercel env | n/a (config) |
| `VITE_SUPABASE_URL` | client bundle | Yes (by design) |
| `VITE_SUPABASE_ANON_KEY` | client bundle | Yes (by design — RLS is the guard) |

  Rule: the `VITE_` prefix may only appear on values that are safe to ship in
  the public bundle. `.env.example` is updated to exactly this list in B0/B1.

---

## Security posture

- **Trust boundary:** browser above, Vercel functions + Supabase below. The
  service-role key appears only in functions (`rate_limits` bookkeeping,
  account merge); sensitive multi-step operations (merge, export, delete) go
  through functions, never direct client calls.
- **RLS-by-default:** enforced structurally (migration templates) and verified
  adversarially — CI runs the Supabase stack locally (Docker) and a test suite
  authenticates as user A and attempts to read/write user B's rows across
  every table; any success fails the build.
- **AI lane abuse control:** input caps + model allow-list + per-identity rate
  limiting (the follow-up the current `api/chat.js` comment promises).
- **No secrets in dev browser:** `vercel dev` keeps keys server-side locally
  too; the dev-proxy header hack is deleted.

---

## Testing

- **Lane 1:** Vitest contract tests per handler — request in, assert
  status/envelope/caps/rate-limit behavior, Anthropic `fetch` mocked (extends
  the existing `src/lib/claude.test.js` pattern). Middleware helpers unit-tested
  in isolation.
- **Lane 2:** RLS adversarial suite against `supabase start` in CI (new job);
  sync engine unit tests with a fake transport and fake clock (merge rules,
  debounce, offline no-op).
- **Gate unchanged:** `npm test` / `npm run lint` / `npm run format:check`
  remain the done-signal; `.husky/pre-commit` still runs the full suite.

---

## Phasing (German app stays shippable at every step)

| Phase | Scope | Owner | Done when |
|---|---|---|---|
| **B0** | Lane 1 hardening: `/api/v1/ai/*` routes, shared middleware, error envelope, rate limiting, secret rename, `vercel dev` story, legacy `/api/chat` shim, `docs/api/` pages | Claude Code spec+plan → Cursor executes | Functions tested; prod chat works via `/api/v1/ai/chat`; old clients still work |
| **B1** | Supabase project, migrations (schema above), RLS policies, CI policy-test job | Claude Code (schema/RLS design + CI) | Adversarial RLS suite green in CI; no app behavior change |
| **B2** | Lazy anonymous identity + `src/lib/sync.js` behind a feature flag | Claude Code spec+plan → Cursor executes most | Sync round-trips for one device; flag off = app identical to today. **Depends on A6 (card.id) merged** |
| **B3** | Account linking UI (Google + magic link), merge-on-link paths, export/delete endpoints | Claude Code (merge semantics, security review) + Cursor (UI) | Two-device sync via linked account; merge paths tested |
| **B4** | Pack delivery endpoints go live | Triggered by pack #2 existing, not by time | Second pack loads via API in a test build |

Phases B0–B4 are an independent track from the platform spec's Phases 0–4;
the interlocks are: B2←A6 (card identity), `pack_id` column ↔ Phase 4
namespacing, prompts stay client-side until Phase 1.3.

---

## Manual steps (owner-performed; agents will prompt at the right moment)

- **Now (already requested in session):** `npm i -g vercel && vercel login &&
  vercel link` — unblocks env/log introspection for everything below.
- **At B0 (before the B0 deploy):** in Vercel env, add `ANTHROPIC_API_KEY`
  alongside the existing `VITE_`-named key (same value) and set
  `ALLOWED_ORIGINS`; delete the old `VITE_` name only after the B0 deploy is
  verified. This ordering keeps prod chat working through the rename.
- **At B1 start:** create the free Supabase project (EU region), enable
  anonymous sign-ins, `brew install supabase/tap/supabase`, `supabase login` +
  `supabase link`; add `SUPABASE_SERVICE_ROLE_KEY` to Vercel env; add
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to Vercel env and local `.env`.
- **At B3 start:** create the Google OAuth client (agent provides exact
  console steps + redirect URLs).

---

## Open questions routed to sub-specs (not blockers for this design)

- Exact SRS merge tie-breaks and clock-skew handling → **B2 spec**.
- Final rate-limit quotas after observing real usage → **B0 review**.
- Additional auth providers (Apple, GitHub?) → **B3 spec**.
- Telemetry pipeline into BigQuery (event schema, ingestion path) → its own
  future arc; nothing in this design blocks it.

---

## Appendix A — rejected alternatives (and why)

**B — Single API gateway** (client talks only to our functions; functions hold
the service-role key and proxy all data ops): moves authorization from
DB-enforced RLS into hand-written checks in every endpoint — one forgotten
`WHERE user_id = ?` is a silent leak with no backstop; widens the service-role
key's blast radius to every function; adds a cold-start + double network hop
to every data operation and burns serverless invocation quota. Worth revisiting
only if API consumers multiply (native mobile app, third-party clients).

**C — Standalone server** (Fastify/NestJS/Spring on Fly/Railway): an entire
security surface (TLS, patching, DoS, sessions) and a 24/7 bill for traffic
that serverless absorbs on free tiers. No requirement (websockets, stateful
compute) currently justifies it.

**Platform alternatives:** Firebase — anonymous→linked auth exists, but
Firestore's NoSQL shape fights relational SRS data and adds a second console
ecosystem; Vercel Postgres + Auth.js — keeps one vendor but means hand-rolling
the anonymous→linked identity flow this design depends on; BigQuery as app
DB — wrong tool class (analytics warehouse), stays parked for telemetry.
