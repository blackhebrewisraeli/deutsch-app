# Pack delivery — `/api/v1/packs` (reserved, NOT implemented)

Contract reserved by the backend architecture spec (lane 3). Implementation
is triggered by the existence of a second language pack — until then packs
ship bundled in the build and these routes do not exist.

| Endpoint                | Returns                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `GET /api/v1/packs`     | `[{ "id": "de", "name": "German", "nativeName": "Deutsch", "version": "1.0.0" }]`       |
| `GET /api/v1/packs/:id` | Pack manifest + content (shape finalized in the B4 sub-spec)                            |

Do not implement, stub, or route these in B0–B3.
