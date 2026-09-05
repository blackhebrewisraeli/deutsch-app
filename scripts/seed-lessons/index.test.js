import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'index.js');

describe('seed-lessons CLI', () => {
  it('--dry-run validates the build and writes nothing without a service-role key', () => {
    const env = { ...process.env };
    delete env.SUPABASE_URL;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    const result = spawnSync(process.execPath, [SCRIPT, '--dry-run'], {
      env,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/dry run/i);
    expect(result.stdout).toMatch(/vocab/i);
    expect(result.stderr).not.toMatch(/SUPABASE_URL is not set/);
  });
});
