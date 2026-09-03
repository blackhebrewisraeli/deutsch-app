# Content lane — `/api/v1/content/*`

Lesson content is **public**: no `Authorization` header, no user rows, no
ownership. It is the API twin of the static lexicon under `/lexicon/de/`.

## `GET /api/v1/content/lessons`

Query parameters (all required, all validated against closed sets):

| Param        | Values                                      |
| ------------ | ------------------------------------------- |
| `courseCode` | `de`                                        |
| `level`      | `a1` · `a2` · `b1`                          |
| `tab`        | `chat` · `alphabet` · `vocab` · `translate` |

Query parameters rather than path segments: this project compiles static
function filenames and has no dynamic `[param]` routes.

```
GET /api/v1/content/lessons?courseCode=de&level=a1&tab=vocab
```

**200**

```json
{
  "lessons": [
    {
      "id": "…uuid…",
      "courseCode": "de",
      "level": "a1",
      "tab": "vocab",
      "unitNumber": 1,
      "exercises": [{ "id": "greet-001", "type": "flashcard", "payload": {} }]
    }
  ]
}
```

No `{ "success": true }` wrapper — the rest of `/api/v1` returns the resource
directly and puts failure in `{ "error": { "code", "message" } }`.

An empty result is `200` with `"lessons": []`, never `404`. A tab with no
units yet is not an error.

**Exercise types** are a closed set: `flashcard` · `translate` · `chat` ·
`multiple-choice`. `alphabet` is a _tab_, not a type — an alphabet unit is a
row with `tab = 'alphabet'` whose exercises are flashcards or
multiple-choice. `payload` is schemaless and owned by the type; the API does
not validate its keys.

An element missing `id` or `type`, or carrying an unknown `type`, is dropped
from the response and logged with a count. A malformed row does not fail the
request — one bad exercise must not take down a whole tab.

**Errors:** `400 bad_request` (unknown or missing parameter), `403 forbidden`
(origin), `405 method_not_allowed`, `429 rate_limited`, `500 server_error`.

**Writes:** none. `lessons` has no insert/update/delete policy; seed and
import go through `service_role`.
