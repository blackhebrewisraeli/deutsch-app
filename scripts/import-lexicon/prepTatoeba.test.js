import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTatoebaPairs } from './prepTatoeba.js';

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'tatoeba-'));
  writeFileSync(
    join(dir, 'deu_sentences.tsv'),
    ['10\tdeu\tIch esse Brot.', '11\tdeu\tWir gehen.', '12\tdeu\tDas ist gut.'].join('\n') + '\n'
  );
  writeFileSync(
    join(dir, 'eng_sentences.tsv'),
    ['20\teng\tI eat bread.', '21\teng\tWe go.', '22\teng\tThat is good.'].join('\n') + '\n'
  );
  return dir;
};

describe('buildTatoebaPairs', () => {
  it('joins de↔en pairs via links, matching either link direction', async () => {
    const dir = setup();
    // 10→20 forward; 21→11 REVERSE (eng id first); 99→98 unknown ids (skipped)
    writeFileSync(join(dir, 'links.csv'), ['10\t20', '21\t11', '99\t98'].join('\n') + '\n');
    await buildTatoebaPairs(dir);
    expect(readFileSync(join(dir, 'tatoeba-de-en.tsv'), 'utf8')).toBe(
      'Ich esse Brot.\tI eat bread.\nWir gehen.\tWe go.\n'
    );
  });

  it('keeps only one English pairing per German sentence', async () => {
    const dir = setup();
    writeFileSync(join(dir, 'links.csv'), ['10\t20', '10\t22'].join('\n') + '\n');
    await buildTatoebaPairs(dir);
    expect(readFileSync(join(dir, 'tatoeba-de-en.tsv'), 'utf8')).toBe(
      'Ich esse Brot.\tI eat bread.\n'
    );
  });

  it('is idempotent: skips when the output already exists', async () => {
    const dir = setup();
    writeFileSync(join(dir, 'links.csv'), '10\t20\n');
    writeFileSync(join(dir, 'tatoeba-de-en.tsv'), 'SENTINEL\n');
    await buildTatoebaPairs(dir);
    expect(readFileSync(join(dir, 'tatoeba-de-en.tsv'), 'utf8')).toBe('SENTINEL\n');
  });
});
