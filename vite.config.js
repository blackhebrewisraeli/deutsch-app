import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
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
    server: {
      // Proxy Anthropic API calls through Vite dev server to bypass CORS
      // and keep your API key out of the browser.
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.VITE_ANTHROPIC_API_KEY) {
                proxyReq.setHeader('x-api-key', env.VITE_ANTHROPIC_API_KEY);
                proxyReq.setHeader('anthropic-version', '2023-06-01');
                proxyReq.setHeader(
                  'anthropic-dangerous-direct-browser-access',
                  'true'
                );
              }
            });
          },
        },
      },
    },
  };
});
