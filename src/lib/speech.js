// Web Speech API: text-to-speech in the active pack's locale.
import { activePack } from '../packs';

export const speak = (text, lang = activePack.meta.locale, rate = 0.9) => {
  // Guard window: ChatTab schedules speak() on a timeout that can fire after
  // jsdom teardown when the suite is slow (unhandled ReferenceError → red hook).
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const base = lang.split('-')[0];
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(base));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
};

// Pre-load voices on module import (some browsers load async)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}
