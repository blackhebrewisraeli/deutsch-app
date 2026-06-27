// Fun auto-assigned handles: AdjectiveNounNN. German-learning flavoured.
const ADJ = ['Blue', 'Swift', 'Clever', 'Brave', 'Sunny', 'Mighty', 'Gentle', 'Bright'];
const NOUN = ['Fuchs', 'Adler', 'Wolf', 'Bär', 'Hirsch', 'Falke', 'Igel', 'Otter'];

export function generateHandle(rng = Math.random) {
  const adj = ADJ[Math.floor(rng() * ADJ.length)];
  const noun = NOUN[Math.floor(rng() * NOUN.length)];
  const nn = String(Math.floor(rng() * 100)).padStart(2, '0');
  return `${adj}${noun}${nn}`;
}
