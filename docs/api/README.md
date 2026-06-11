# deutsch-app API — conventions

The REST half of the **developer interface** (the other half is the database
contract, arriving in phase B1). Spec:
`docs/superpowers/specs/2026-06-10-backend-architecture-design.md`.

- **Base path:** `/api/v1/` — breaking changes mean `/api/v2/`; shipped `/v1`
  contracts stay stable.
- **Auth:** none in B0. Phase B2 adds optional Supabase JWTs (anonymous-first).
- **Error envelope** — every non-2xx produced by our functions:

  ```json
  { "error": { "code": "<machine_code>", "message": "<human text>" } }
  ```

  | code                 | HTTP | meaning                                          |
  | -------------------- | ---- | ------------------------------------------------ |
  | `bad_request`        | 400  | body failed validation                           |
  | `unauthorized`       | 401  | reserved for B2 (JWT auth)                       |
  | `forbidden`          | 403  | Origin present but not allow-listed              |
  | `method_not_allowed` | 405  | only POST is accepted                            |
  | `rate_limited`       | 429  | quota exceeded — honor `Retry-After` (seconds)   |
  | `upstream_error`     | 502  | Anthropic unreachable / network failure          |
  | `server_error`       | 500  | missing server configuration or unexpected failure |

  Upstream Anthropic **error responses pass through unchanged** (their own
  `{ "type": "error", "error": { ... } }` shape and status).

- **Rate limits** are per client IP in B0 (per user id once B2 ships JWTs),
  fixed windows, best-effort per function instance until B1's durable store.
