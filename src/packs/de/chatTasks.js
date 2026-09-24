// Per-scenario, per-level chat tasks — the goal a learner works toward.

export const CHAT_TASKS = {
  free: {
    a1: [
      { task: 'Say hello and tell Anna your name.', hint: 'Hallo! Ich heiße [dein Name].' },
      { task: 'Ask Anna how she is.', hint: 'Wie geht es dir?' },
      { task: 'Tell Anna what you like to eat.', hint: 'Ich esse gerne [food].' },
    ],
    a2: [
      {
        task: 'Ask Anna what she does for work and where she lives.',
        hint: 'Was machst du beruflich? Wo wohnst du?',
      },
      {
        task: 'Tell Anna about your daily routine.',
        hint: 'Ich stehe um ... Uhr auf und dann ...',
      },
      {
        task: 'Describe your family to Anna.',
        hint: 'Ich habe [einen Bruder / zwei Schwestern / ...].',
      },
    ],
    b1: [
      {
        task: 'Tell Anna about an interesting place you visited recently and why you liked it.',
        hint: null,
      },
      {
        task: 'Discuss with Anna whether big cities are better to live in than small towns.',
        hint: null,
      },
      { task: 'Explain to Anna a problem you had recently and how you solved it.', hint: null },
    ],
  },
  coffee: {
    a1: [
      { task: 'Order a coffee.', hint: 'Einen Kaffee, bitte.' },
      { task: 'Ask for the bill.', hint: 'Die Rechnung, bitte.' },
    ],
    a2: [
      {
        task: 'Order a large coffee and ask how much it costs.',
        hint: 'Einen großen Kaffee, bitte. Was kostet das?',
      },
      {
        task: 'Ask if they have decaf and order a piece of cake too.',
        hint: 'Haben Sie entkoffeinierten Kaffee? Ich nehme auch ein Stück Kuchen.',
      },
    ],
    b1: [
      {
        task: 'Make a reservation for four people this evening and ask about the menu.',
        hint: null,
      },
      {
        task: 'Complain politely that your order is wrong and ask for the correct item.',
        hint: null,
      },
    ],
  },
  meet: {
    a1: [
      {
        task: 'Introduce yourself — give your name and say where you are from.',
        hint: 'Ich heiße ... und komme aus ...',
      },
      { task: 'Ask Anna her name and where she is from.', hint: 'Wie heißt du? Woher kommst du?' },
    ],
    a2: [
      {
        task: 'Ask Anna about her hobbies and tell her yours.',
        hint: 'Was machst du in deiner Freizeit? Ich ... gerne.',
      },
      {
        task: 'Invite Anna to do something together this weekend.',
        hint: 'Hast du am Wochenende Zeit? Wir könnten ...',
      },
    ],
    b1: [
      {
        task: 'Have a natural small-talk conversation — ask Anna about her week and share something interesting about yours.',
        hint: null,
      },
    ],
  },
  airport: {
    a1: [
      { task: 'Ask where the check-in desk is.', hint: 'Entschuldigung, wo ist der Check-in?' },
      { task: 'Ask how much the ticket costs.', hint: 'Was kostet das Ticket?' },
    ],
    a2: [
      {
        task: 'Ask a staff member where gate B12 is and how long the walk takes.',
        hint: 'Entschuldigung, wo ist Gate B12? Wie lange dauert der Weg?',
      },
      {
        task: 'Tell the check-in agent you have one suitcase to check and ask about hand luggage rules.',
        hint: 'Ich habe einen Koffer aufzugeben. Was sind die Handgepäckregeln?',
      },
    ],
    b1: [
      {
        task: 'Explain to staff that your flight was cancelled and ask what your options are.',
        hint: null,
      },
    ],
  },
};

// ─── Alphabet Quiz — Confusable Letter Groups ─────────────────────────────────

/**
 * Each group is four letters that sound similar or are visually confusable.
 * AlphabetTab plays one letter and asks the learner to identify it from these four.
 */
