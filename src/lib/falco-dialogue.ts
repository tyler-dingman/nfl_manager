import { createRng } from '@/lib/deterministic-rng';

export const falcoResignPositive = [
  'Smart restraint. You kept the room stable.',
  "That's clean roster work. No noise.",
  'You protected the core. It matters.',
  'Balanced and steady. The cap breathes.',
  "That's how you keep a locker room intact.",
  'You kept leverage. You kept options.',
];

export const falcoResignNeutral = [
  'You got through it. The margin is thin.',
  'Not perfect, not broken. Keep moving.',
  'Some holes remain. The next phase matters.',
  'You made choices. The board will answer.',
  "It's workable. Discipline has to follow.",
  'You left yourself a path forward.',
];

export const falcoResignNegative = [
  'The cap is tight. Every move is sharper now.',
  'That was costly. The next phase has no slack.',
  'You survived, but the margin is gone.',
  'This will force tough decisions later.',
  "You're paying for flexibility you don't have.",
  "Hard spot. You'll need clean execution next.",
];

export const falcoFreeAgencyPositive = [
  'You landed impact without losing control.',
  'Smart adds. No panic.',
  "That's a clean free agency cycle.",
  "Value and fit. That's the formula.",
  'You filled needs without bleeding the cap.',
  'Good work. The roster looks sharper.',
];

export const falcoFreeAgencyRisk = [
  "That's a lot of risk on the books.",
  'The cap is loud. The roster has to answer.',
  'You chased upside. The margin shrank.',
  'You got talent. You also got pressure.',
  'The room will feel it if these deals miss.',
  'You moved fast. Now you have to be right.',
];

export const falcoDraftStandard = [
  'Solid process. The board makes sense.',
  'You stayed on your plan. Good.',
  'Clean picks. Little noise.',
  'The floor is stable. That helps.',
  'You worked the board, not the panic.',
  "That's a steady draft.",
];

export const falcoDraftSteal = [
  'You found value. That changes ceilings.',
  'Those are wins that echo later.',
  'You took what the board gave you.',
  'Big value at the right time.',
  "That's how you build depth fast.",
  'Great timing. The board favored you.',
];

export const falcoDraftReach = [
  'You reached for need. The risk is real.',
  "That's a swing. It can work, but it's loud.",
  "You paid for the fit. We'll see if it holds.",
  "The board didn't love it. The room has to.",
  "That's a bet. You'll need it to hit.",
  'You moved early. It cost you value.',
];

const pickFromPool = (pool: string[], seed: string) => {
  if (pool.length === 0) return '';
  const rng = createRng(seed);
  const index = Math.floor(rng() * pool.length);
  return pool[index] ?? pool[0];
};

export const pickFalcoQuote = (pool: string[], seed: string) => pickFromPool(pool, seed);
