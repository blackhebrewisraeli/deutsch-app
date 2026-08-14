// German chat scenarios — the situations a learner can practise in.
//
// Each carries its own opening greeting. Nested rather than held in a parallel
// map so a scenario without one cannot be expressed; validate.js enforces it.

export const SCENARIOS = [
  {
    id: 'free',
    name: 'Free Chat',
    icon: '◆',
    desc: 'open conversation',
    greeting: {
      de: 'Hallo! Womit möchtest du heute üben?',
      ipa: '[ˈhalo vomɪt ˈmœçtəst duː ˈhɔɪ̯tə ˈyːbn̩]',
      en: 'Hello! What would you like to practice today?',
    },
  },
  {
    id: 'coffee',
    name: 'Order Coffee',
    icon: '☕',
    desc: 'at a Berlin café',
    greeting: {
      de: 'Willkommen im Café! Was möchten Sie bestellen?',
      ipa: '[vɪlˈkɔmən ɪm kaˈfeː vas ˈmœçtən ziː bəˈʃtɛlən]',
      en: 'Welcome to the café! What would you like to order?',
    },
  },
  {
    id: 'meet',
    name: 'Meet Someone',
    icon: '✶',
    desc: 'small talk & intros',
    greeting: {
      de: 'Hallo! Ich bin Anna. Wie heißt du?',
      ipa: '[ˈhalo ɪç bɪn ˈana viː haɪ̯st duː]',
      en: "Hello! I'm Anna. What's your name?",
    },
  },
  {
    id: 'airport',
    name: 'At the Airport',
    icon: '✈',
    desc: 'check-in & directions',
    greeting: {
      de: 'Guten Tag, willkommen am Flughafen. Wohin reisen Sie?',
      ipa: '[ˈɡuːtn̩ taːk vɪlˈkɔmən am ˈfluːkhaːfn̩ voˈhɪn ˈʁaɪ̯zn̩ ziː]',
      en: 'Good day, welcome to the airport. Where are you traveling?',
    },
  },
];
