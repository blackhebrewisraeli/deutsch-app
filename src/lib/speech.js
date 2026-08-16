// Web Speech API: text-to-speech in the active pack's locale.
import { activePack } from '../packs';

/**
 * The voice to use for a language, best first:
 *   1. a name the pack asked for,
 *   2. a voice the platform flags as default,
 *   3. the first match — the behaviour before this existed.
 *
 * Names are the only stable handle the Web Speech API offers; there is no
 * quality flag. So this is a hint that degrades, not a guarantee.
 */
function pickVoice(voices, base, preference = []) {
  const forLang = voices.filter((v) => v.lang?.startsWith(base));
  for (const name of preference) {
    const hit = forLang.find((v) => v.name === name);
    if (hit) return hit;
  }
  return forLang.find((v) => v.default) ?? forLang[0];
}

export const speak = (text, lang = activePack.meta.locale, rate = 0.9) => {
  // Guard window: ChatTab schedules speak() on a timeout that can fire after
  // jsdom teardown when the suite is slow (unhandled ReferenceError → red hook).
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voice = pickVoice(
    window.speechSynthesis.getVoices(),
    lang.split('-')[0],
    activePack.meta.voicePreference
  );
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
};

// Pre-load voices on module import (some browsers load async)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}
