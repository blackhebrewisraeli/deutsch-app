import { describe, it, expect, beforeAll } from 'vitest';
import { adminClient, anonClient, createSignedInUser } from './helpers.js';

// Adversarial suite for the avatars bucket.
//
// The unit tests can only prove the CLIENT builds a path of the right shape.
// Only a real Postgres can prove the policy rejects one that is not — and the
// bucket is PUBLIC, so a hole here is a hole anyone can walk through.
//
// The case worth the whole file is `renaming into another user's folder`. A
// policy written with `using` but no `with check` passes every other test here:
// ownership on SELECT, INSERT and DELETE all behave, and only the UPDATE path
// lets a learner move their own object into someone else's namespace and
// overwrite their avatar. Run this suite against such a policy and that one
// test is the only thing that fails.
//
// Requires the local stack: `supabase start` (Docker), then `npm run test:rls`.

const BUCKET = 'avatars';
const bytes = () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' });

let admin;
let alice;
let bob;
let alicePath;

beforeAll(async () => {
  admin = adminClient();
  alice = await createSignedInUser('storage-alice');
  bob = await createSignedInUser('storage-bob');

  alicePath = `${alice.id}/first.webp`;
  const { error } = await alice.client.storage.from(BUCKET).upload(alicePath, bytes(), {
    contentType: 'image/webp',
  });
  if (error) throw new Error(`fixture upload failed: ${error.message}`);
});

describe('avatars bucket configuration', () => {
  it('exists and is public', async () => {
    const { data, error } = await admin.storage.getBucket(BUCKET);
    expect(error).toBeNull();
    expect(data.public).toBe(true);
  });

  // The single most important line in the migration. An SVG in a public bucket
  // served from our own origin is stored XSS with a friendly extension.
  it('does NOT allow image/svg+xml', async () => {
    const { data } = await admin.storage.getBucket(BUCKET);
    expect(data.allowed_mime_types).not.toContain('image/svg+xml');
    expect(data.allowed_mime_types).toEqual(
      expect.arrayContaining(['image/webp', 'image/png', 'image/jpeg'])
    );
  });

  it('caps object size at 256 KB on the SERVER, not just in the client', async () => {
    const { data } = await admin.storage.getBucket(BUCKET);
    expect(data.file_size_limit).toBe(262144);
  });

  it('actually rejects an oversized upload', async () => {
    const big = new Blob([new Uint8Array(300 * 1024)], { type: 'image/webp' });
    const { error } = await alice.client.storage
      .from(BUCKET)
      .upload(`${alice.id}/too-big.webp`, big, { contentType: 'image/webp' });
    expect(error).not.toBeNull();
  });

  it('actually rejects an SVG upload', async () => {
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], {
      type: 'image/svg+xml',
    });
    const { error } = await alice.client.storage
      .from(BUCKET)
      .upload(`${alice.id}/x.svg`, svg, { contentType: 'image/svg+xml' });
    expect(error).not.toBeNull();
  });
});

describe('reading is public', () => {
  it('lets a signed-out visitor fetch another user’s avatar', async () => {
    // This is the requirement that made the bucket public: leaderboards render
    // avatars for people the viewer has no relationship with.
    const { data, error } = await anonClient().storage.from(BUCKET).download(alicePath);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });
});

describe('writing is confined to your own folder', () => {
  it('lets a user upload into their own folder', async () => {
    const { error } = await bob.client.storage
      .from(BUCKET)
      .upload(`${bob.id}/mine.webp`, bytes(), { contentType: 'image/webp' });
    expect(error).toBeNull();
  });

  it('refuses an upload into someone else’s folder', async () => {
    const { error } = await bob.client.storage
      .from(BUCKET)
      .upload(`${alice.id}/intruder.webp`, bytes(), { contentType: 'image/webp' });
    expect(error).not.toBeNull();
  });

  it('refuses an upload at the bucket root, where there is no owner segment', async () => {
    const { error } = await bob.client.storage
      .from(BUCKET)
      .upload('rootless.webp', bytes(), { contentType: 'image/webp' });
    expect(error).not.toBeNull();
  });

  it('refuses to overwrite someone else’s object', async () => {
    const { error } = await bob.client.storage
      .from(BUCKET)
      .upload(alicePath, bytes(), { contentType: 'image/webp', upsert: true });
    expect(error).not.toBeNull();
  });

  it('refuses to delete someone else’s object', async () => {
    await bob.client.storage.from(BUCKET).remove([alicePath]);
    // remove() can report success with an empty result set, so the proof is
    // that the object is still downloadable afterwards.
    const { error } = await anonClient().storage.from(BUCKET).download(alicePath);
    expect(error).toBeNull();
  });

  it('lets a user delete their own object', async () => {
    const path = `${bob.id}/disposable.webp`;
    await bob.client.storage.from(BUCKET).upload(path, bytes(), { contentType: 'image/webp' });
    const { error } = await bob.client.storage.from(BUCKET).remove([path]);
    expect(error).toBeNull();
    const after = await anonClient().storage.from(BUCKET).download(path);
    expect(after.error).not.toBeNull();
  });

  // ── THE `with check` TEST ────────────────────────────────────────
  //
  // `using` alone would permit this: the row being updated IS Bob's, so the
  // USING clause passes. Only `with check` inspects what the row looks like
  // AFTERWARDS and refuses to let the name land in Alice's folder.
  it('refuses to RENAME an owned object into another user’s folder', async () => {
    const path = `${bob.id}/movable.webp`;
    await bob.client.storage.from(BUCKET).upload(path, bytes(), { contentType: 'image/webp' });

    const target = `${alice.id}/stolen.webp`;
    const { error } = await bob.client.storage.from(BUCKET).move(path, target);
    expect(error, 'move into another user folder must be refused').not.toBeNull();

    // And nothing landed there.
    const { error: dlErr } = await anonClient().storage.from(BUCKET).download(target);
    expect(dlErr).not.toBeNull();
  });

  it('allows a rename WITHIN your own folder', async () => {
    const from = `${bob.id}/rename-me.webp`;
    await bob.client.storage.from(BUCKET).upload(from, bytes(), { contentType: 'image/webp' });
    const { error } = await bob.client.storage.from(BUCKET).move(from, `${bob.id}/renamed.webp`);
    expect(error).toBeNull();
  });
});

describe('profiles.avatar_path', () => {
  it('exists and defaults to null', async () => {
    const { data, error } = await admin
      .from('profiles')
      .select('avatar_path')
      .eq('user_id', alice.id)
      .single();
    expect(error).toBeNull();
    expect(data.avatar_path).toBeNull();
  });
});
