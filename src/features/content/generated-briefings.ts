import generatedBriefings from '@/server/data-cache/team-briefings.json';

import type { TeamBriefing } from './types';

const briefings = generatedBriefings as Record<string, TeamBriefing[]>;

export const getGeneratedTeamBriefings = (teamAbbr: string) =>
  briefings[teamAbbr.toUpperCase()] ?? [];
