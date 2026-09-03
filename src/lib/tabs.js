// The app's four practice tabs. A leaf module on purpose: quests.js needs this
// list, stats.js needs currentStreak from streak.js, and streak.js now needs
// quests.js — so if quests.js read TABS from stats.js the three would form a
// cycle and TABS would be undefined at module-evaluation time. gamification.js
// hit the same cycle once already (see its gamificationContext docstring) and
// worked around it by injection. A constant with no dependencies belongs in a
// leaf, where nothing can cycle through it.
export const TABS = ['chat', 'alphabet', 'vocab', 'translate'];
