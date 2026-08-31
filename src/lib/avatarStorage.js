// Putting a prepared avatar into the bucket, and taking the old one back out.
//
// Writes go DIRECT to Storage rather than through an endpoint, which is the
// opposite of how profile fields work — those need the server for handle
// uniqueness and the league_members denormalisation. Storage needs neither: the
// RLS policies in 20260901000000_avatars_bucket.sql are the authority, and they
// are enforced by Postgres whatever the client sends. Proxying the bytes
// through a serverless function would add a hop, a body-size ceiling and a
// second place for the ownership rule to be written down.
//
// The PATH is the security boundary: `{user_id}/{uuid}.webp`. The policies
// compare the first segment to auth.uid(), so a path built any other way is
// rejected by the database rather than merely being untidy.

import { getSupabase } from './auth.js';

export const AVATAR_BUCKET = 'avatars';

/**
 * `{user_id}/{random}.webp`.
 *
 * The random segment makes every upload a NEW object. That is deliberate:
 * overwriting in place would leave a window where the URL resolves to a
 * half-written object, and it would make "delete the one I replaced" impossible
 * to express. It also means the path cannot be derived from the user id alone,
 * which matters in a public bucket.
 */
export function avatarPathFor(userId) {
  const rand =
    globalThis.crypto?.randomUUID?.() ??
    Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
  return `${userId}/${rand}.webp`;
}

/**
 * Upload `blob` as this user's avatar and return the stored path.
 *
 * @throws {Error} with the storage error's message, which is what the UI shows.
 */
export async function uploadAvatar(userId, blob, { client } = {}) {
  const supabase = client ?? (await getSupabase());
  if (!supabase) throw new Error('Sign in to change your avatar.');

  const path = avatarPathFor(userId);
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: blob.type,
    // Never overwrite: the path is random, so a collision means something is
    // wrong, and upsert would hide it.
    upsert: false,
  });
  if (error) throw new Error(error.message ?? 'Could not upload that image.');
  return path;
}

/**
 * Remove a previously stored object. Best-effort by design.
 *
 * A failure here leaves an orphan in the bucket — 40-odd KB nobody references.
 * That is strictly better than the alternative: if this threw, a learner whose
 * NEW avatar uploaded fine would see the whole change fail because the OLD one
 * could not be tidied up. The upload is the thing they asked for.
 */
export async function removeAvatar(path, { client } = {}) {
  if (!path) return false;
  try {
    const supabase = client ?? (await getSupabase());
    if (!supabase) return false;
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return !error;
  } catch {
    return false;
  }
}
