import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The commit a bundle was built from, stamped into Sentry as the `release`.
 *
 * Without it every error in Sentry is attributable to "production" and nothing
 * finer, so a regression cannot be tied to the deploy that introduced it — which
 * is most of the value of having the errors at all.
 *
 * Resolution order: an explicit override, then Vercel's own build-time commit
 * var, then local git for `npm run build` on a developer box. Empty string when
 * none resolve (a git-less CI checkout, a tarball), which `observability.js`
 * turns back into `undefined` so Sentry simply records no release rather than a
 * literal "unknown" that would group every such build together.
 */
function resolveRelease() {
  if (process.env.VITE_SENTRY_RELEASE) return process.env.VITE_SENTRY_RELEASE;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    // execFileSync, not execSync: no shell, so nothing here can be interpolated.
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

const SENTRY_RELEASE = resolveRelease();

// https://vitejs.dev/config/
// API calls go to /api/v1/ai/* — Vercel functions in production, served
// locally by `npm run dev:full` (vercel dev). No dev proxy, no key in Vite.
export default defineConfig({
  // Replaces the literal expression at build time. Defined here rather than
  // exported through a .env file because the value is derived per build, and a
  // static env var would pin every deploy to whatever commit was current when
  // someone last edited it in the Vercel dashboard.
  define: {
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(SENTRY_RELEASE),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service worker caches all app assets for offline use
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Don't cache API calls — those need to be live
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/lexicon\/.*\.json$/,
            // NOT CacheFirst. The lexicon URLs are unhashed (/lexicon/chunk-00.json),
            // so a re-import writes new bytes to the same path and the cache key never
            // changes — and runtimeCaching caches are not part of the precache
            // manifest, so registerType:'autoUpdate' never purges them. Under
            // CacheFirst a returning visitor kept the pre-merge lexicon, duplicate
            // homograph cards included, until the 30-day expiry (verified against
            // production 2026-08-01). StaleWhileRevalidate still answers instantly and
            // still answers with no network at all — offline is unchanged — but every
            // online load refreshes in the background, so the next one is current.
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'lexicon-json',
              // Under SWR this only evicts what nobody has opened in a month.
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      manifest: {
        name: 'Deutsch. Sprachschule',
        short_name: 'Deutsch.',
        description: 'Learn German with AI-powered guided exercises',
        theme_color: '#16110b',
        background_color: '#FBF8F1',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
