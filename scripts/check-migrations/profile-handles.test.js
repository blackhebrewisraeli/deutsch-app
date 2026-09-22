import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

function handleMigration() {
  const filename = readdirSync(migrationsDir).find((name) =>
    name.endsWith('_backfill_profile_handles.sql')
  );
  expect(filename, 'profile handle migration').toBeTruthy();
  return readFileSync(join(migrationsDir, filename), 'utf8');
}

describe('profile handle migration', () => {
  it('backfills existing profiles and makes handles required and unique', () => {
    const sql = handleMigration();
    expect(sql).toMatch(/update public\.profiles/i);
    expect(sql).toMatch(/handle is null|btrim\(handle\) = ''/i);
    expect(sql).toMatch(/alter column handle set not null/i);
    expect(sql).toMatch(/unique.*handle|handle.*unique/i);
  });

  it('assigns a fallback handle when the signup trigger creates a profile', () => {
    const sql = handleMigration();
    expect(sql).toMatch(/create or replace function public\.handle_new_user/i);
    expect(sql).toMatch(/insert into public\.profiles\s*\(user_id, handle\)/i);
  });
});
