// Web Speech API: text-to-speech for German
export const speak = (text, lang = 'de-DE', rate = 0.9) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const deVoice = voices.find((v) => v.lang.startsWith('de'));
  if (deVoice && lang.startsWith('de')) u.voice = deVoice;
  window.speechSynthesis.speak(u);
};

// Pre-load voices on module import (some browsers load async)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}
