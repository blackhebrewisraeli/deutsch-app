import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, anonClient, createSignedInUser } from './helpers.js';

// lessons is CONTENT, not user data: everyone reads, nobody but service_role
// writes. That is the inverse of every other table in this suite, so the
// assertions run the opposite way round — a successful client write is the hole.

const ROW = {
  pack_id: 'de',
  course_code: 'de',
  level: 'a1',
  tab: 'vocab',
  unit_number: 1,
  exercises: [{ id: 'greet-001', type: 'flashcard', payload: {} }],
};

const admin = adminClient();

let A;
let seeded;

beforeAll(async () => {
  A = await createSignedInUser('lessons-a');
  const { data, error } = await admin.from('lessons').insert(ROW).select().single();
  expect(error).toBeNull();
  seeded = data;
});

afterAll(async () => {
  if (seeded?.id) await admin.from('lessons').delete().eq('id', seeded.id);
});

describe('RLS: lessons', () => {
  it('an anonymous client can read', async () => {
    const { data, error } = await anonClient().from('lessons').select('*').eq('id', seeded.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('a signed-in client can read', async () => {
    const { data, error } = await A.client.from('lessons').select('*').eq('id', seeded.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('a signed-in client CANNOT insert', async () => {
    const { error } = await A.client.from('lessons').insert({ ...ROW, unit_number: 99 });
    expect(error).not.toBeNull();
  });

  it('a signed-in client CANNOT update', async () => {
    const { error } = await A.client.from('lessons').update({ level: 'b1' }).eq('id', seeded.id);
    // PostgREST reports a blocked UPDATE as an error OR as zero rows affected;
    // assert the row is unchanged either way, which is the property that matters.
    const { data } = await admin.from('lessons').select('level').eq('id', seeded.id).single();
    expect(data.level).toBe('a1');
    expect(error === null || error !== null).toBe(true);
  });

  it('a signed-in client CANNOT delete', async () => {
    await A.client.from('lessons').delete().eq('id', seeded.id);
    const { data } = await admin.from('lessons').select('id').eq('id', seeded.id);
    expect(data).toHaveLength(1);
  });

  it('rejects a level outside the closed set', async () => {
    const { error } = await admin.from('lessons').insert({ ...ROW, level: 'c1', unit_number: 2 });
    expect(error).not.toBeNull();
  });

  it('rejects a course_code outside the v1 allow-list', async () => {
    const { error } = await admin
      .from('lessons')
      .insert({ ...ROW, course_code: 'de-he', unit_number: 3 });
    expect(error).not.toBeNull();
  });

  it('rejects exercises that are not a JSON array', async () => {
    const { error } = await admin
      .from('lessons')
      .insert({ ...ROW, exercises: { nope: true }, unit_number: 4 });
    expect(error).not.toBeNull();
  });
});
