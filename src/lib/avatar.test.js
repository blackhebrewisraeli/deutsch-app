import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { identicon, identiconDataUri, avatarUrl, avatarFor, hashSeed, GRID } from './avatar.js';

const countRects = (svg) => (svg.match(/<rect /g) ?? []).length;

describe('identicon', () => {
  it('is deterministic — the same seed always draws the same mark', () => {
    expect(identicon('user-a')).toBe(identicon('user-a'));
  });

  it('gives different users different marks', () => {
    // A sweep, not one pair: two seeds colliding is luck either way, and a
    // generator that returned a constant would pass a single comparison half
    // the time.
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) seen.add(identicon(`user-${i}`));
    expect(seen.size).toBeGreaterThan(190);
  });

  it('is horizontally mirrored', () => {
    const svg = identicon('mirror-me', { size: 50 });
    const cell = 50 / GRID;
    const xs = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    // Every drawn cell must have its mirror drawn too.
    for (const [x, y] of xs) {
      const col = Math.round(x / cell);
      const mirrored = (GRID - 1 - col) * cell;
      expect(xs.some(([mx, my]) => Math.abs(mx - mirrored) < 0.01 && my === y)).toBe(true);
    }
  });

  it('draws something, but not everything', () => {
    // A generator stuck on all-on or all-off is still "deterministic" and still
    // "different per user" if the colour moves — this is what catches that.
    const totals = Array.from({ length: 40 }, (_, i) => countRects(identicon(`u${i}`)));
    expect(Math.min(...totals)).toBeGreaterThan(1);
    expect(Math.max(...totals)).toBeLessThan(GRID * GRID + 1);
  });

  it('scales with the requested size', () => {
    expect(identicon('x', { size: 32 })).toContain('viewBox="0 0 32 32"');
    expect(identicon('x', { size: 128 })).toContain('width="128"');
  });

  it('never emits a script or a foreign object', () => {
    // It is inlined as a data: URI, so this is the guard that keeps it inert.
    const svg = identicon('<script>alert(1)</script>');
    expect(svg).not.toMatch(/<script|foreignObject|onload=/i);
  });

  it('encodes to a data URI an <img> can use', () => {
    expect(identiconDataUri('abc')).toMatch(/^data:image\/svg\+xml,/);
    expect(decodeURIComponent(identiconDataUri('abc').slice('data:image/svg+xml,'.length))).toBe(
      identicon('abc')
    );
  });
});

describe('hashSeed', () => {
  it('is a stable 32-bit unsigned value', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).toBeGreaterThanOrEqual(0);
    expect(hashSeed('abc')).toBeLessThan(2 ** 32);
  });

  it('does not collapse empty and null to different answers', () => {
    expect(hashSeed(null)).toBe(hashSeed(''));
  });
});

describe('avatarUrl', () => {
  it('composes a public object URL from the path', () => {
    expect(avatarUrl('u1/abc.webp', 'https://proj.supabase.co')).toBe(
      'https://proj.supabase.co/storage/v1/object/public/avatars/u1/abc.webp'
    );
  });

  it('tolerates a trailing slash on the base', () => {
    expect(avatarUrl('u1/a.webp', 'https://proj.supabase.co/')).toBe(
      'https://proj.supabase.co/storage/v1/object/public/avatars/u1/a.webp'
    );
  });

  it('is null without a path, or when no base is configured', () => {
    expect(avatarUrl(null, 'https://x')).toBeNull();
    // `null`, not `undefined`: undefined falls through to the default
    // parameter, which reads VITE_SUPABASE_URL and is SET in this environment.
    // Asserting on undefined would test the local .env, not the function.
    expect(avatarUrl('u1/a.webp', null)).toBeNull();
    expect(avatarUrl('u1/a.webp', '')).toBeNull();
  });
});

describe('avatarFor — the tier order', () => {
  const base = 'https://proj.supabase.co';

  it('prefers an uploaded image over everything', () => {
    const r = avatarFor({
      profile: { avatar_path: 'u1/a.webp' },
      userId: 'u1',
      base,
    });
    expect(r.kind).toBe('image');
    expect(r.src).toContain('/avatars/u1/a.webp');
  });

  it('generates an identicon when there is no upload', () => {
    const r = avatarFor({ profile: {}, userId: 'u1', base });
    expect(r.kind).toBe('identicon');
    expect(r.src).toMatch(/^data:image\/svg\+xml,/);
  });

  it('ignores a leftover emoji field rather than drawing it', () => {
    const r = avatarFor({ profile: { avatar_emoji: '🦊' }, userId: 'u1', base });
    expect(r.kind).toBe('identicon');
    expect(r).not.toHaveProperty('glyph');
  });

  // The whole reason the seed is the id: a rename must not change your face.
  it('keys the identicon on the user id, NOT the handle', () => {
    const a = avatarFor({ profile: { handle: 'before' }, userId: 'u1' });
    const b = avatarFor({ profile: { handle: 'after' }, userId: 'u1' });
    expect(a.src).toBe(b.src);

    const other = avatarFor({ profile: { handle: 'before' }, userId: 'u2' });
    expect(other.src).not.toBe(a.src);
  });

  it('still draws something for a guest with no id at all', () => {
    expect(avatarFor({}).kind).toBe('identicon');
    expect(avatarFor({}).src).toBe(avatarFor({ userId: null }).src);
  });

  it('falls back to the identicon when no storage base is configured', () => {
    // Local dev without VITE_SUPABASE_URL must not render a broken image.
    const r = avatarFor({ profile: { avatar_path: 'u1/a.webp' }, base: null });
    expect(r.kind).toBe('identicon');
  });
});

// The emoji column is gone. A second hard-coded glyph, or a source still
// reading the dropped field, would put two "no avatar" pictures back in the
// tree — the exact disagreement avatarFor exists to prevent.
describe('no leftover emoji fallback', () => {
  const ROOTS = ['src', 'api'];

  function stripComments(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith('*')) return '';
    return line.replace(/\/\*.*?\*\//g, '').replace(/(^|[^:])\/\/.*$/, '$1');
  }

  function walkSources(dir, out = []) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walkSources(full, out);
        continue;
      }
      if (/\.(jsx|js)$/.test(name) && !/\.test\.(jsx|js)$/.test(name)) out.push(full);
    }
    return out;
  }

  it('does not read avatar_emoji from any non-test source', () => {
    const files = ROOTS.flatMap((root) => walkSources(root));
    expect(files.length).toBeGreaterThan(20);

    const offenders = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (stripComments(line).includes('avatar_emoji')) {
            offenders.push(`${relative('.', file)}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders, `leftover avatar_emoji reads:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('does not leave a hard-coded fallback glyph in the painters', () => {
    const files = [
      'src/lib/avatar.js',
      'src/components/ui/Avatar.jsx',
      'src/components/settings/AvatarPicker.jsx',
    ];
    const offenders = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const code = stripComments(line);
          if (
            code.includes('🦊') ||
            code.includes('🙂') ||
            /kind\s*===\s*['"]emoji['"]/.test(code)
          ) {
            offenders.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders, `hard-coded fallback glyphs:\n${offenders.join('\n')}`).toEqual([]);
  });
});
