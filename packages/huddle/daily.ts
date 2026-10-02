import type { Game, Message, Poll } from './index';
export type DailyHuddle = {
  id: string;
  team: string;
  date: string;
  status: 'ACTIVE' | 'ARCHIVED';
  summary: string;
  description: string;
  featuredPollId: string | null;
  pulseLabel: string;
  topPollId?: string;
  finalRecord?: string;
  metrics: { hereNow: number; comments: number; fans: number; polls: number };
  previous: { id: string; date: string; summary: string; comments: number }[];
  fixture?: boolean;
};
export function dailyRoomId(team: string, date: string) {
  return `daily:${team.toUpperCase()}:${date}`;
}
/** An already-resolved selected-team game takes precedence. No provider calls here. */
export function huddleExperience(game: Game | null, team: string, date: string) {
  return game && [game.home, game.away].includes(team) && game.kickoff.slice(0, 10) === date
    ? 'gameday'
    : 'daily';
}
export function dailyEntries(messages: Message[], tab: string, oldestFirst = false) {
  return messages
    .filter((m) => !m.removed && (tab !== 'Chat' || !m.kind || m.kind === 'comment'))
    .slice()
    .sort((a, b) => (oldestFirst ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)));
}
export function pollResult(poll?: Poll) {
  const total = poll?.counts.reduce((a, b) => a + b, 0) ?? 0;
  return { total, percent: total ? Math.round(((poll!.counts[0] ?? 0) / total) * 100) : 0 };
}
export const compactCount = (n: number) =>
  Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const dailyDate = (date: string, short = false) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: short ? 'short' : 'long',
    month: short ? 'short' : 'long',
    day: 'numeric',
  });
