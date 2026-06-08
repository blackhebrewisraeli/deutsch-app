import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('speak', () => {
  let cancel;
  let speakFn;
  let getVoices;
  let lastUtterance;

  beforeEach(() => {
    vi.resetModules();
    cancel = vi.fn();
    speakFn = vi.fn();
    getVoices = vi.fn(() => [
      { lang: 'en-US', name: 'English' },
      { lang: 'de-DE', name: 'German' },
    ]);

    globalThis.SpeechSynthesisUtterance = vi.fn(function SpeechSynthesisUtterance(text) {
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.voice = null;
      lastUtterance = this;
    });

    window.speechSynthesis = { cancel, speak: speakFn, getVoices };
  });

  afterEach(() => {
    delete window.speechSynthesis;
    delete globalThis.SpeechSynthesisUtterance;
    lastUtterance = null;
  });

  it('cancels pending speech and speaks with default de-DE locale', async () => {
    const { speak } = await import('./speech');
    speak('Guten Tag');
    expect(cancel).toHaveBeenCalled();
    expect(speakFn).toHaveBeenCalledWith(lastUtterance);
    expect(lastUtterance.text).toBe('Guten Tag');
    expect(lastUtterance.lang).toBe('de-DE');
    expect(lastUtterance.rate).toBe(0.9);
    expect(lastUtterance.voice?.lang).toBe('de-DE');
  });

  it('does not assign a German voice when lang is not German', async () => {
    const { speak } = await import('./speech');
    speak('Hello', 'en-US');
    expect(lastUtterance.lang).toBe('en-US');
    expect(lastUtterance.voice).toBeNull();
  });

  it('is a no-op when speechSynthesis is unavailable', async () => {
    delete window.speechSynthesis;
    const { speak } = await import('./speech');
    expect(() => speak('Hallo')).not.toThrow();
  });

  it('honours a custom speech rate', async () => {
    const { speak } = await import('./speech');
    speak('Langsam', 'de-DE', 0.5);
    expect(lastUtterance.rate).toBe(0.5);
  });
});
