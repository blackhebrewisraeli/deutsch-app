import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, anonClient, createSignedInUser } from './helpers.js';

// feedback is write-only for clients: INSERT own (or NULL user_id when
// anonymous), no SELECT / UPDATE / DELETE. service_role is the owner read path.
// Guest inserts are deliberate — FeedbackButton has no auth gate.

const admin = adminClient();

const row = (over = {}) => ({
  surface: 'vocab',
  cefr_level: 'a2',
  deck_id: 'greetings',
  item_id: 'de-hallo',
  item_label: 'Hallo',
  category: 'ui',
  message: 'the button overlap',
  ...over,
});

let A;
let B;
const insertedIds = [];

beforeAll(async () => {
  A = await createSignedInUser('feedback-a');
  B = await createSignedInUser('feedback-b');
});

afterAll(async () => {
  if (insertedIds.length) {
    await admin.from('feedback').delete().in('id', insertedIds);
  }
  if (A?.id) await admin.from('feedback').delete().eq('user_id', A.id);
  if (B?.id) await admin.from('feedback').delete().eq('user_id', B.id);
});

describe('RLS: feedback', () => {
  it('A inserts an own row', async () => {
    const { error } = await A.client.from('feedback').insert(row({ user_id: A.id }));
    expect(error).toBeNull();
  });

  it('B inserts an own row (fixture for cross-user attempts)', async () => {
    const { error } = await B.client.from('feedback').insert(row({ user_id: B.id }));
    expect(error).toBeNull();
  });

  it('an anonymous client can insert a guest row', async () => {
    const message = `guest report ${Date.now()}`;
    const { error } = await anonClient()
      .from('feedback')
      .insert(row({ user_id: null, message }));
    expect(error).toBeNull();

    const { data } = await admin
      .from('feedback')
      .select('id, user_id, message')
      .eq('message', message)
      .is('user_id', null)
      .limit(1);
    expect(data).toHaveLength(1);
    insertedIds.push(data[0].id);
  });

  it('service_role can read the reports', async () => {
    const { data, error } = await admin.from('feedback').select('user_id').eq('user_id', A.id);
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });

  it('A cannot read any feedback — not even their own', async () => {
    const { data, error } = await A.client.from('feedback').select('*');
    expect(error).not.toBeNull();
    expect(error.code).toBe('42501');
    expect(data).toBeNull();
  });

  it('anon cannot read any feedback', async () => {
    const { data, error } = await anonClient().from('feedback').select('*');
    expect(error).not.toBeNull();
    expect(error.code).toBe('42501');
    expect(data).toBeNull();
  });

  it('A cannot insert a row claiming to be B', async () => {
    const { error } = await A.client.from('feedback').insert(row({ user_id: B.id }));
    expect(error).not.toBeNull();
  });

  it('A cannot insert an unattributed row while signed in', async () => {
    const { error } = await A.client.from('feedback').insert(row({ user_id: null }));
    expect(error).not.toBeNull();
  });

  it('anon cannot insert a row claiming a signed-in user_id', async () => {
    const { error } = await anonClient()
      .from('feedback')
      .insert(row({ user_id: A.id }));
    expect(error).not.toBeNull();
  });

  it("A cannot update or delete B's rows", async () => {
    await A.client.from('feedback').update({ message: 'pwned' }).eq('user_id', B.id);
    await A.client.from('feedback').delete().eq('user_id', B.id);

    const { data } = await admin.from('feedback').select('message').eq('user_id', B.id);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.message !== 'pwned')).toBe(true);
  });

  it('rejects an empty message at the constraint, not after insert', async () => {
    const { error } = await A.client.from('feedback').insert(row({ message: '' }));
    expect(error).not.toBeNull();
  });

  it('rejects a category outside the closed set', async () => {
    const { error } = await A.client.from('feedback').insert(row({ category: 'other' }));
    expect(error).not.toBeNull();
  });
});
