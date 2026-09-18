import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createSignedInUser } from './helpers.js';

// blocked_at is service-role only. A learner who PATCHes their own profile
// must not be able to clear a block or invent one. Feedback INSERT is denied
// for a blocked signed-in user; guests are unchanged.

const admin = adminClient();

let A;

beforeAll(async () => {
  A = await createSignedInUser('roles-a');
});

afterAll(async () => {
  if (A?.id) {
    await admin.from('feedback').delete().eq('user_id', A.id);
    await admin.from('profiles').update({ blocked_at: null }).eq('user_id', A.id);
  }
});

describe('RLS: profiles.blocked_at', () => {
  it('A cannot write blocked_at on their own row', async () => {
    const { error } = await A.client
      .from('profiles')
      .update({ blocked_at: new Date().toISOString() })
      .eq('user_id', A.id);
    expect(error).not.toBeNull();

    const { data } = await admin.from('profiles').select('blocked_at').eq('user_id', A.id).single();
    expect(data.blocked_at).toBeNull();
  });

  it('A cannot clear a block the admin set', async () => {
    const { error: setErr } = await admin
      .from('profiles')
      .update({ blocked_at: new Date().toISOString() })
      .eq('user_id', A.id);
    expect(setErr).toBeNull();

    const { error } = await A.client
      .from('profiles')
      .update({ blocked_at: null })
      .eq('user_id', A.id);
    expect(error).not.toBeNull();

    const { data } = await admin.from('profiles').select('blocked_at').eq('user_id', A.id).single();
    expect(data.blocked_at).not.toBeNull();
  });
});

describe('RLS: blocked users cannot insert feedback', () => {
  it('A is rejected while blocked, and can insert again after unblock', async () => {
    await admin
      .from('profiles')
      .update({ blocked_at: new Date().toISOString() })
      .eq('user_id', A.id);

    const { error: blockedErr } = await A.client.from('feedback').insert({
      user_id: A.id,
      category: 'ui',
      message: 'should not land',
    });
    expect(blockedErr).not.toBeNull();

    await admin.from('profiles').update({ blocked_at: null }).eq('user_id', A.id);

    const { error } = await A.client.from('feedback').insert({
      user_id: A.id,
      category: 'ui',
      message: 'unblocked report',
    });
    expect(error).toBeNull();
  });
});
