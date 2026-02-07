import type { FalcoAlertItem } from '@/features/draft/falco-alert-store';
import { teamChants } from '@/lib/team-chants';

export const buildChantAlert = (
  teamAbbr: string | undefined,
  type: 'BIG_SIGNING' | 'BIG_TRADE',
): FalcoAlertItem => {
  const chant = (teamAbbr && teamChants[teamAbbr]?.chant) ?? 'Falco Alert';
  const createdAt = new Date().toISOString();
  return {
    id: `${type.toLowerCase()}-${teamAbbr ?? 'team'}-${createdAt}`,
    type,
    title: chant,
    message: "That's a statement move. The room will feel it.",
    lines: ["That's a statement move.", 'The room will feel it.'],
    createdAt,
  };
};

export const buildCapCrisisAlert = (): FalcoAlertItem => {
  const createdAt = new Date().toISOString();
  return {
    id: `cap-crisis-${createdAt}`,
    type: 'CAP_CRISIS',
    title: 'Falco Alert',
    message: "You're in the red. Pain heals. Glory lasts forever-but not if you can't sign anyone.",
    lines: [
      "You're in the red.",
      'Pain heals.',
      "Glory lasts forever-but not if you can't sign anyone.",
    ],
    createdAt,
  };
};
