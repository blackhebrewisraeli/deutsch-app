// German chat scenarios — the situations a learner can practise in.
//
// `role` is who the AI plays in the scene. There is no stored opener: the AI
// writes it in character, at the learner's level (see chatKickoffMessage in
// src/lib/prompts.js). validate.js enforces the role.

export const SCENARIOS = [
  {
    id: 'free',
    name: 'Free Chat',
    icon: '◆',
    desc: 'open conversation',
    role: {
      name: 'Anna',
      brief:
        'Anna, a friendly, curious local who enjoys chatting with language learners about everyday life.',
    },
  },
  {
    id: 'coffee',
    name: 'Order Coffee',
    icon: '☕',
    desc: 'at a Berlin café',
    role: {
      name: 'Barista',
      brief:
        'a friendly barista at a busy Berlin café. You greet customers, take their order and handle payment.',
    },
  },
  {
    id: 'meet',
    name: 'Meet Someone',
    icon: '✶',
    desc: 'small talk & intros',
    role: {
      name: 'Anna',
      brief:
        'Anna, a friendly person the learner has just met at a party in Berlin. You make small talk and get to know them.',
    },
  },
  {
    id: 'airport',
    name: 'At the Airport',
    icon: '✈',
    desc: 'check-in & directions',
    role: {
      name: 'Check-in',
      brief:
        'a helpful check-in agent at Frankfurt Airport. You check passengers in, handle luggage and give directions to gates.',
    },
  },
];
