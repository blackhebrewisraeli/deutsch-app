import { describe, it, expect } from 'vitest';
import { mergeSrs } from './merge.js';

describe('mergeSrs', () => {
  const card = (lastReviewed, box) => ({ box, lastReviewed, nextDue: lastReviewed + 1, reps: 1 });

  it('keeps the record with the more recent lastReviewed', () => {
    const local = { 'greetings:hallo': card(200, 3) };
    const remote = { 'greetings:hallo': card(100, 2) };
    expect(mergeSrs(local, remote)['greetings:hallo'].box).toBe(3); // local newer
    expect(mergeSrs(remote, local)['greetings:hallo'].box).toBe(3); // symmetric
  });

  it('unions cards present on only one side', () => {
    const local = { a: card(100, 1) };
    const remote = { b: card(100, 1) };
    const out = mergeSrs(local, remote);
    expect(Object.keys(out).sort()).toEqual(['a', 'b']);
  });

  it('a real lastReviewed beats null/undefined', () => {
    const local = { x: { box: 1, lastReviewed: null, nextDue: 0, reps: 0 } };
    const remote = { x: card(100, 4) };
    expect(mergeSrs(local, remote).x.box).toBe(4);
  });

  it('exact tie resolves to the remote (server) record', () => {
    const local = { x: card(100, 2) };
    const remote = { x: card(100, 5) };
    expect(mergeSrs(local, remote).x.box).toBe(5);
  });
});
