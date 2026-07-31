import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
// API calls go to /api/v1/ai/* — Vercel functions in production, served
// locally by `npm run dev:full` (vercel dev). No dev proxy, no key in Vite.
export default defineConfig({
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
        background_color: '#FDF3C0',
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
