import { getSourcesForTeam } from '@/data/sources';

import { buildCanonicalEvents } from './event-engine';
import { KC_SEED_SOURCE_ITEMS } from './seeds/kc';
import type { SourceItem } from './types';

const teamSeeds: Record<string, SourceItem[]> = { KC: KC_SEED_SOURCE_ITEMS };

export const buildTeamEvents = (teamId: string) => {
  const normalizedTeamId = teamId.toUpperCase();
  return buildCanonicalEvents({
    teamId: normalizedTeamId,
    items: teamSeeds[normalizedTeamId] ?? [],
    sources: getSourcesForTeam(normalizedTeamId),
  });
};
