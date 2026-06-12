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

  it('cancels pending speech and defaults to the active pack locale', async () => {
    const { speak } = await import('./speech');
    const { activePack } = await import('../packs');
    speak('Guten Tag');
    expect(cancel).toHaveBeenCalled();
    expect(speakFn).toHaveBeenCalledWith(lastUtterance);
    expect(lastUtterance.text).toBe('Guten Tag');
    expect(lastUtterance.lang).toBe(activePack.meta.locale);
    expect(lastUtterance.rate).toBe(0.9);
    expect(lastUtterance.voice?.lang).toBe(activePack.meta.locale);
  });

  it('picks a voice matching the requested language, not the pack default', async () => {
    const { speak } = await import('./speech');
    speak('Hello', 'en-US');
    expect(lastUtterance.lang).toBe('en-US');
    expect(lastUtterance.voice?.lang).toBe('en-US');
  });

  it('leaves the voice unset when no voice matches the language', async () => {
    getVoices.mockReturnValue([{ lang: 'fr-FR', name: 'French' }]);
    const { speak } = await import('./speech');
    speak('Hola', 'es-ES');
    expect(lastUtterance.lang).toBe('es-ES');
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
