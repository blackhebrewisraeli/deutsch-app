import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sortByFrequency, buildFreqTsv } from './prep.js';

describe('sortByFrequency', () => {
  it('sorts lines by the col-3 frequency, descending', () => {
    const lines = ['1\tselten\t5', '2\tder\t45508', '3\tund\t34104'];
    expect(sortByFrequency(lines)).toEqual([
      '2\tder\t45508',
      '3\tund\t34104',
      '1\tselten\t5',
    ]);
  });
  it('drops blank lines and treats malformed frequency as 0 (sorts last)', () => {
    const lines = ['1\tder\t100', '', '2\tkaputt', '3\tund\t50'];
    expect(sortByFrequency(lines)).toEqual(['1\tder\t100', '3\tund\t50', '2\tkaputt']);
  });
  it('does not mutate the input array', () => {
    const lines = ['1\ta\t1', '2\tb\t2'];
    sortByFrequency(lines);
    expect(lines).toEqual(['1\ta\t1', '2\tb\t2']);
  });
});

describe('buildFreqTsv', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'prep-'));
    mkdirSync(join(dir, 'deu_news_2023_100K'));
    writeFileSync(
      join(dir, 'deu_news_2023_100K', 'deu_news_2023_100K-words.txt'),
      '1\tselten\t5\n2\tder\t45508\n'
    );
    return dir;
  };
  it('writes freq.tsv sorted by frequency', () => {
    const dir = setup();
    buildFreqTsv(dir);
    expect(readFileSync(join(dir, 'freq.tsv'), 'utf8')).toBe('2\tder\t45508\n1\tselten\t5\n');
  });
  it('is idempotent: skips when freq.tsv exists', () => {
    const dir = setup();
    writeFileSync(join(dir, 'freq.tsv'), 'SENTINEL\n');
    buildFreqTsv(dir);
    expect(readFileSync(join(dir, 'freq.tsv'), 'utf8')).toBe('SENTINEL\n');
  });
});
