import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  prepareAvatar,
  centreCrop,
  ImagePrepError,
  ACCEPTED_TYPES,
  MAX_INPUT_BYTES,
  AVATAR_SIZE,
  OUTPUT_TYPE,
} from './imagePrep.js';

// WHAT THIS FILE CAN AND CANNOT PROVE.
//
// jsdom has no image decoder and no canvas raster, so "the EXIF block is gone"
// is NOT assertable here — there is nothing to decode a real JPEG with. Saying
// so out loud matters, because a test named `strips EXIF` that only checks a
// mime type would be a fixture that cannot express its own failure.
//
// What IS assertable, and is what actually regresses: that the bytes go through
// a canvas at all. The realistic mistake is someone "optimising" an already-
// WebP input to skip the re-encode and return the picked File unchanged — at
// which point EXIF survives and the bucket is public. `returns a NEW blob` is
// the guard for exactly that.
//
// The end-to-end claim is verified in a real browser instead, against a JPEG
// carrying real EXIF GPS tags.

let ctx;
let toBlobResult;
let lastCanvas;

const stubDoc = () => ({
  createElement: () => {
    lastCanvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb, type, quality) => {
        lastCanvas.encodedAs = { type, quality };
        cb(toBlobResult);
      },
    };
    return lastCanvas;
  },
});

const file = (over = {}) => ({ type: 'image/jpeg', size: 1000, ...over });

beforeEach(() => {
  ctx = { drawImage: vi.fn() };
  toBlobResult = new Blob(['re-encoded'], { type: OUTPUT_TYPE });
  lastCanvas = null;

  // A stand-in decoder: onload fires with the dimensions the test asked for.
  vi.stubGlobal(
    'Image',
    class {
      constructor() {
        this.naturalWidth = 800;
        this.naturalHeight = 600;
        setTimeout(() => this.onload?.(), 0);
      }
    }
  );
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
});

afterEach(() => vi.unstubAllGlobals());

describe('centreCrop', () => {
  it('takes the largest square from the middle of a landscape image', () => {
    expect(centreCrop(800, 600)).toEqual({ sx: 100, sy: 0, side: 600 });
  });

  it('and from the middle of a portrait image', () => {
    expect(centreCrop(600, 800)).toEqual({ sx: 0, sy: 100, side: 600 });
  });

  it('is a no-op on an already-square image', () => {
    expect(centreCrop(500, 500)).toEqual({ sx: 0, sy: 0, side: 500 });
  });

  it('never returns a fractional offset — canvas source rects are pixels', () => {
    const { sx, sy } = centreCrop(801, 600);
    expect(Number.isInteger(sx)).toBe(true);
    expect(Number.isInteger(sy)).toBe(true);
  });
});

describe('prepareAvatar — validation', () => {
  it('rejects nothing at all', async () => {
    await expect(prepareAvatar(null, { doc: stubDoc() })).rejects.toBeInstanceOf(ImagePrepError);
  });

  it('rejects a type the bucket would reject anyway', async () => {
    // SVG is the one that matters: it is a script container, and the bucket's
    // allowed_mime_types excludes it deliberately.
    await expect(
      prepareAvatar(file({ type: 'image/svg+xml' }), { doc: stubDoc() })
    ).rejects.toThrow(/JPEG, PNG or WebP/i);
  });

  it('accepts every type the bucket allows', async () => {
    for (const type of ACCEPTED_TYPES) {
      await expect(prepareAvatar(file({ type }), { doc: stubDoc() })).resolves.toBeInstanceOf(Blob);
    }
  });

  it('rejects an absurdly large pick before decoding it', async () => {
    await expect(
      prepareAvatar(file({ size: MAX_INPUT_BYTES + 1 }), { doc: stubDoc() })
    ).rejects.toThrow(/too large/i);
    // Not merely rejected — never handed to the decoder.
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('reports a file that cannot be decoded', async () => {
    vi.stubGlobal(
      'Image',
      class {
        constructor() {
          setTimeout(() => this.onerror?.(), 0);
        }
      }
    );
    await expect(prepareAvatar(file(), { doc: stubDoc() })).rejects.toThrow(/could not be read/i);
  });

  it('releases the object URL even when the decode FAILS', async () => {
    vi.stubGlobal(
      'Image',
      class {
        constructor() {
          setTimeout(() => this.onerror?.(), 0);
        }
      }
    );
    await prepareAvatar(file(), { doc: stubDoc() }).catch(() => {});
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('prepareAvatar — the re-encode', () => {
  it('draws the centre square into a square canvas of the target size', async () => {
    await prepareAvatar(file(), { doc: stubDoc() });
    expect(lastCanvas.width).toBe(AVATAR_SIZE);
    expect(lastCanvas.height).toBe(AVATAR_SIZE);
    // 800x600 → 600px square starting at x=100.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      100,
      0,
      600,
      600,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE
    );
  });

  it('encodes as WebP', async () => {
    const out = await prepareAvatar(file(), { doc: stubDoc() });
    expect(lastCanvas.encodedAs.type).toBe(OUTPUT_TYPE);
    expect(out.type).toBe(OUTPUT_TYPE);
  });

  // THE EXIF GUARD, stated as what is actually checkable: the picked file is
  // never passed through. If a future change short-circuits an already-WebP
  // input, this fails — and that short-circuit is precisely how EXIF would
  // reach a public bucket.
  it('returns a NEW blob, never the picked file', async () => {
    const picked = file({ type: 'image/webp' });
    const out = await prepareAvatar(picked, { doc: stubDoc() });
    expect(out).not.toBe(picked);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('fails loudly when the browser cannot encode WebP', async () => {
    // canvas.toBlob yields null rather than throwing; an unchecked null would
    // upload as "undefined" and fail the bucket's MIME check instead.
    toBlobResult = null;
    await expect(prepareAvatar(file(), { doc: stubDoc() })).rejects.toThrow(/could not process/i);
  });

  it('fails when there is no 2d context', async () => {
    ctx = null;
    await expect(prepareAvatar(file(), { doc: stubDoc() })).rejects.toThrow(/could not process/i);
  });
});
