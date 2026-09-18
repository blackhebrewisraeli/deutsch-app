# AI endpoints — `/api/v1/ai/*`

Three endpoints, one shared contract. The split exists for per-feature rate
quotas and future server-side prompt assembly without a breaking change.
Prompts are client-assembled and pack-owned (platform Phase 1.3).

| Endpoint                 | Used by                                                           | Quota (B0 initial) |
| ------------------------ | ----------------------------------------------------------------- | ------------------ |
| `POST /api/v1/ai/chat`   | Anna conversation turns                                           | 20 req / 5 min     |
| `POST /api/v1/ai/grade`  | Exercise lane: answer grading **and** exercise-sentence generation | 60 req / 5 min     |
| `POST /api/v1/ai/deck`   | Custom deck generation                                            | 5 req / hour       |

## Request (all endpoints)

```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 1000,
  "system": "optional system prompt",
  "messages": [{ "role": "user", "content": "..." }]
}
```

Chat (`POST /api/v1/ai/chat` and the legacy `/api/chat` alias) also accepts:

```json
{
  "level": "a1",
  "vocab": ["Hallo", "Danke"]
}
```

`level` is a lowercase CEFR code (`a1` | `a2` | `b1`); unknown strings clamp
to `a1`, a non-string is `400`. `vocab` is a string array (trimmed, deduped,
capped); a non-array is `400`. Neither field is forwarded to Anthropic — the
handler folds a language-blind appendix into `system` so a client cannot raise
the band by rewriting the prompt alone. Grade and deck ignore these extras
(unknown fields are stripped).

Constraints (requests violating any → `400 bad_request`):

- `model` must be on the allow-list (`api/_lib/validate.js`)
- `max_tokens` clamped to 1024; non-numeric values default to 1000
- 1–100 messages; roles only `user`/`assistant`; string content
- ≤ 100,000 total characters (system + all message content)
- unknown fields are stripped, never forwarded

## Response

2xx: the Anthropic Messages response, passed through unchanged.
Non-2xx: see the envelope table in `README.md`; Anthropic's own errors pass
through with their status.

## Legacy alias

`POST /api/chat` → same handler as `/api/v1/ai/chat`. Kept for already-cached
PWA bundles; scheduled for removal one release cycle after B0 ships.
