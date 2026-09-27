/** Display tiers use lifetime reward yards; they do not alter reward unlock thresholds. */
export const REWARD_TIERS = [
  { name: 'Rookie', min: 0, range: '0–100', color: '#19344a' },
  { name: 'Starter', min: 101, range: '101–250', color: '#315b7c' },
  { name: 'Veteran', min: 251, range: '251–500', color: '#bd7900' },
  { name: 'All-Pro', min: 501, range: '501–1,000', color: '#dd1838' },
  { name: 'Legend', min: 1001, range: '1,001+', color: '#8e43c1' },
] as const;
export function rewardTierProgress(points: number) {
  const total = Math.max(0, Math.floor(points));
  const index = REWARD_TIERS.findLastIndex((tier) => total >= tier.min);
  const current = REWARD_TIERS[index];
  const next = REWARD_TIERS[index + 1] ?? null;
  return {
    current,
    next,
    total,
    remaining: next ? next.min - total : 0,
    fraction: next ? (total - current.min) / (next.min - current.min) : 1,
  };
}
export function activeDayStreak(days: string[], today = new Date().toISOString().slice(0, 10)) {
  const dates = new Set(days);
  let cursor = Date.parse(`${today}T00:00:00Z`);
  if (!dates.has(today)) cursor -= 86400000;
  let count = 0;
  while (dates.has(new Date(cursor).toISOString().slice(0, 10))) {
    count++;
    cursor -= 86400000;
  }
  return count;
}
export type RewardDashboard = {
  nextReward: null | { title: string; thresholdYards: number };
  yardsToNextReward: number;
  progress: { currentDriveYards: number; touchdowns: number; lifetimeYards: number };
  stats?: {
    correctAnswers: number;
    dayStreak: number;
    crewRank: number | null;
    crewRankingAvailable?: boolean;
    globalRank: number;
    totalUsers: number;
  };
  rewards: {
    id: string;
    thresholdYards: number;
    type: string;
    title: string;
    description: string;
    status: string;
    couponCode?: string | null;
  }[];
};
