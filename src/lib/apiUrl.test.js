import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiUrl } from './apiUrl.js';

describe('apiUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('leaves the path relative on the web, where no base is configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(apiUrl('/api/v1/social')).toBe('/api/v1/social');
  });

  it('prefixes the native base, tolerating a trailing slash', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://deutsch-app-dusky.vercel.app/');
    expect(apiUrl('/api/v1/ai/chat')).toBe('https://deutsch-app-dusky.vercel.app/api/v1/ai/chat');
  });
});

// A relative /api fetch works on the web and fails only inside the native app,
// so no jsdom or browser test would ever notice one. Scan for them instead.
describe('every fetch under src/ goes through apiUrl', () => {
  // Static files under public/, copied into dist/ and served by the webview
  // itself — not the API, so they must stay relative.
  const BUNDLED_ASSETS = ['packs/lexiconStore.js'];

  const root = 'src';
  const calls = readdirSync(root, { recursive: true })
    .filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f) && !BUNDLED_ASSETS.includes(f))
    .flatMap((f) =>
      readFileSync(join(root, f), 'utf8')
        .split('\n')
        .filter((line) => /(^|[^\w.])fetch(Impl)?\(/.test(line) && !/^\s*(\/\/|\*)/.test(line))
        .map((line) => `${f}: ${line.trim()}`)
    );

  it('finds the known call sites — a scan that sees nothing proves nothing', () => {
    expect(calls.length).toBeGreaterThanOrEqual(10);
  });

  it('wraps each one in apiUrl()', () => {
    expect(calls.filter((c) => !/fetch(Impl)?\(apiUrl\(/.test(c))).toEqual([]);
  });
});
