export const FAN_PULSE_REACTIONS = [
  'FIRED_UP',
  'LIKE_IT',
  'NOT_SURE',
  'DONT_LOVE_IT',
  'NO_WAY',
] as const;

export type FanPulseReaction = (typeof FAN_PULSE_REACTIONS)[number];
export type FanPulseCounts = Record<FanPulseReaction, number>;

export const EMPTY_FAN_PULSE_COUNTS: FanPulseCounts = {
  FIRED_UP: 0,
  LIKE_IT: 0,
  NOT_SURE: 0,
  DONT_LOVE_IT: 0,
  NO_WAY: 0,
};

export function fanPulsePercentages(counts: FanPulseCounts) {
  const total = FAN_PULSE_REACTIONS.reduce((sum, reaction) => sum + counts[reaction], 0);
  if (!total) return { ...EMPTY_FAN_PULSE_COUNTS };
  const exact = FAN_PULSE_REACTIONS.map((reaction) => ({
    reaction,
    floor: Math.floor((counts[reaction] / total) * 100),
    remainder: (counts[reaction] / total) * 100 - Math.floor((counts[reaction] / total) * 100),
  }));
  let points = 100 - exact.reduce((sum, item) => sum + item.floor, 0);
  for (const item of [...exact].sort((a, b) => b.remainder - a.remainder)) {
    if (points-- <= 0) break;
    item.floor += 1;
  }
  return Object.fromEntries(exact.map((item) => [item.reaction, item.floor])) as FanPulseCounts;
}

export function dominantFanPulse(counts: FanPulseCounts) {
  const total = FAN_PULSE_REACTIONS.reduce((sum, reaction) => sum + counts[reaction], 0);
  if (!total) return null;
  return FAN_PULSE_REACTIONS.reduce((winner, reaction) =>
    counts[reaction] > counts[winner] ? reaction : winner,
  );
}

export function fanPulseSummary(teamName: string, counts: FanPulseCounts) {
  const dominant = dominantFanPulse(counts);
  if (!dominant) return 'Be the first fan to add to the Pulse.';
  const percentage = fanPulsePercentages(counts)[dominant];
  const copy: Record<FanPulseReaction, string> = {
    FIRED_UP: `are fired up about this news`,
    LIKE_IT: `like this news`,
    NOT_SURE: `aren't sure about this one`,
    DONT_LOVE_IT: `don't love this one`,
    NO_WAY: `can't believe this news`,
  };
  return `${percentage}% of ${teamName} fans ${copy[dominant]}.`;
}
