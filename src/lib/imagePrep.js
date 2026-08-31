// Turning whatever a learner picked into something safe to make public.
//
// THE POINT IS NOT FILE SIZE. Re-encoding through a canvas is how the EXIF
// block is discarded, and a phone photo's EXIF carries GPS coordinates. The
// avatars bucket is PUBLIC, so uploading a picked file unmodified would publish
// where the learner was standing when they took it. That is a privacy defect,
// and it is the reason this module exists; the smaller bytes are a side effect.
//
// It also means the uploaded object is always a re-drawn bitmap, so anything
// smuggled alongside the image data — a polyglot file, a trailing payload —
// does not survive the trip.
//
// Everything here is browser-only (Image, canvas, createObjectURL). It is a
// separate module from avatar.js precisely so the pure resolver stays testable
// in a node environment.

export const AVATAR_SIZE = 256;
export const OUTPUT_TYPE = 'image/webp';
export const OUTPUT_QUALITY = 0.85;

/** What the file picker accepts. Mirrors the bucket's allowed_mime_types. */
export const ACCEPTED_TYPES = ['image/webp', 'image/png', 'image/jpeg'];

/** Generous: the bucket's real ceiling is 256 KB AFTER processing. */
export const MAX_INPUT_BYTES = 12 * 1024 * 1024;

export class ImagePrepError extends Error {}

/**
 * Centre-crop box for a source of `w`x`h`.
 *
 * Square, taken from the middle, so a portrait photo keeps the face rather than
 * being squashed. Exported because it is the one piece of arithmetic here worth
 * testing without a DOM.
 */
export function centreCrop(w, h) {
  const side = Math.min(w, h);
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), side };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      // Revoked on BOTH paths: a failed decode still holds the object URL, and
      // leaking one per rejected file is a leak that only shows up in a long
      // session of failed picks.
      URL.revokeObjectURL(url);
      reject(new ImagePrepError('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/**
 * Validate, centre-crop, downscale and re-encode.
 *
 * @param {File|Blob} file
 * @returns {Promise<Blob>} a WebP blob with no metadata
 * @throws {ImagePrepError} with a message meant for the learner
 */
export async function prepareAvatar(file, { size = AVATAR_SIZE, doc = document } = {}) {
  if (!file) throw new ImagePrepError('Choose an image first.');
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImagePrepError('Pick a JPEG, PNG or WebP image.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImagePrepError('That image is too large — pick one under 12 MB.');
  }

  const img = await loadImage(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new ImagePrepError('That file could not be read as an image.');

  const { sx, sy, side } = centreCrop(w, h);
  const canvas = doc.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImagePrepError('Your browser could not process that image.');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY));
  // A browser without WebP encoding returns null rather than throwing, and a
  // null here would upload as "undefined" and fail the bucket's MIME check with
  // a message nobody could act on.
  if (!blob) throw new ImagePrepError('Your browser could not process that image.');
  return blob;
}
