#!/usr/bin/env node
// `npm run clean` — remove build/dev caches so stale artifacts can't mislead a
// debugging session. Safe: the allowlist in `scripts/lib/cleanCaches.js` is
// only regenerable scratch. Exits 0 when nothing is present.
import { removeCacheTargets } from './lib/cleanCaches.js';

removeCacheTargets();
