import { describe, it, expect, beforeAll } from 'vitest';
import { anonClient, createSignedInUser } from './helpers.js';

// Adversarial RLS suite: authenticated as user A, attempt every cross-user
// operation against user B through real PostgREST. Any success = RLS hole.

let A;
let B;

beforeAll(async () => {
  A = await createSignedInUser('a');
  B = await createSignedInUser('b');
});

// Per-table row factories — minimal valid rows owned by the given user.
const TABLES = [
  { name: 'srs_state', row: (uid) => ({ user_id: uid, srs_key: 'greetings:Hallo', box: 2 }) },
  {
    name: 'stats_daily',
    row: (uid) => ({ user_id: uid, day: '2026-06-12', counters: { total: 1 } }),
  },
  {
    name: 'decks',
    row: (uid) => ({ user_id: uid, deck_id: 'custom', name: 'My deck', cards: [] }),
  },
  { name: 'settings', row: (uid) => ({ user_id: uid, data: { soundOn: true } }) },
];

for (const t of TABLES) {
  describe(`RLS: ${t.name}`, () => {
    it('A inserts an own row', async () => {
      const { error } = await A.client.from(t.name).insert(t.row(A.id));
      expect(error).toBeNull();
    });

    it('B inserts an own row (fixture for cross-user attempts)', async () => {
      const { error } = await B.client.from(t.name).insert(t.row(B.id));
      expect(error).toBeNull();
    });

    it("A cannot see B's rows", async () => {
      const { data, error } = await A.client.from(t.name).select('*').eq('user_id', B.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('A cannot insert a row claiming to be B', async () => {
      const { error } = await A.client.from(t.name).insert(t.row(B.id));
      expect(error).not.toBeNull();
    });

    it("A cannot update or delete B's rows (zero rows affected)", async () => {
      const { data: updated, error: updateError } = await A.client
        .from(t.name)
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', B.id)
        .select();
      expect(updateError).toBeNull();
      expect(updated).toEqual([]);

      const { data: deleted, error: deleteError } = await A.client
        .from(t.name)
        .delete()
        .eq('user_id', B.id)
        .select();
      expect(deleteError).toBeNull();
      expect(deleted).toEqual([]);
    });
  });
}

describe('RLS: profiles', () => {
  it('the signup trigger created A their own profile, visible to A', async () => {
    const { data, error } = await A.client.from('profiles').select('*');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].user_id).toBe(A.id);
  });

  it("A cannot see B's profile", async () => {
    const { data, error } = await A.client.from('profiles').select('*').eq('user_id', B.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("A cannot update B's profile (zero rows affected)", async () => {
    const { data, error } = await A.client
      .from('profiles')
      .update({ display_name: 'pwned' })
      .eq('user_id', B.id)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe('RLS: anonymous access', () => {
  it('a bare anon client sees zero rows in every user table', async () => {
    const anon = anonClient();
    for (const table of ['profiles', 'srs_state', 'stats_daily', 'decks', 'settings']) {
      const { data, error } = await anon.from(table).select('*');
      expect(error, `table ${table}`).toBeNull();
      expect(data, `table ${table}`).toEqual([]);
    }
  });
});

describe('RLS: rate_limits', () => {
  it('is invisible to authenticated users', async () => {
    const { data, error } = await A.client.from('rate_limits').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
