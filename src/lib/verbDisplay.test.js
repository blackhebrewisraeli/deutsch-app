import { describe, it, expect } from 'vitest';
import { formatVerb } from './verbDisplay';

const present = (over = {}) => ({
  ich: null,
  du: null,
  er: null,
  wir: null,
  ihr: null,
  sie: null,
  ...over,
});

describe('formatVerb', () => {
  it('returns [] for null / non-object', () => {
    expect(formatVerb(null)).toEqual([]);
    expect(formatVerb(undefined)).toEqual([]);
    expect(formatVerb('nope')).toEqual([]);
  });
  it('returns [] for an all-null block', () => {
    expect(formatVerb({ aux: null, partizip2: null, present: present() })).toEqual([]);
  });
  it('renders er-form + Perfekt with sein → ist', () => {
    expect(
      formatVerb({ aux: 'sein', partizip2: 'gegangen', present: present({ er: 'geht' }) })
    ).toEqual([
      { label: 'er', value: 'geht' },
      { label: 'Perfekt', value: 'ist gegangen' },
    ]);
  });
  it('renders Perfekt with haben → hat', () => {
    expect(
      formatVerb({ aux: 'haben', partizip2: 'gemacht', present: present({ er: 'macht' }) })
    ).toEqual([
      { label: 'er', value: 'macht' },
      { label: 'Perfekt', value: 'hat gemacht' },
    ]);
  });
  it('falls back to Part. II when aux is null', () => {
    expect(
      formatVerb({ aux: null, partizip2: 'gemacht', present: present({ er: 'macht' }) })
    ).toEqual([
      { label: 'er', value: 'macht' },
      { label: 'Part. II', value: 'gemacht' },
    ]);
  });
  it('renders only the er-form when there is no partizip2', () => {
    expect(formatVerb({ aux: null, partizip2: null, present: present({ er: 'geht' }) })).toEqual([
      { label: 'er', value: 'geht' },
    ]);
  });
  it('renders only Perfekt when there is no er-form', () => {
    expect(formatVerb({ aux: 'haben', partizip2: 'gesagt', present: present() })).toEqual([
      { label: 'Perfekt', value: 'hat gesagt' },
    ]);
  });
});
