import { DATA_PROVIDER_SOURCES } from './data-providers';
import { NATIONAL_SOURCES } from './national';
import { KC_SOURCES } from './teams/kc';
import type { SourceDefinition } from './types';
import { RESEARCH_SOURCE_ADDITIONS } from './research';

const TEAM_SOURCES: Record<string, SourceDefinition[]> = { KC: KC_SOURCES };

export const getSourcesForTeam = (teamId: string) => [
  ...NATIONAL_SOURCES,
  ...(TEAM_SOURCES[teamId.toUpperCase()] ?? []),
  ...DATA_PROVIDER_SOURCES,
  ...RESEARCH_SOURCE_ADDITIONS.filter((source) => source.teamIds?.includes(teamId.toUpperCase())),
];

export const getAllSources = () => [
  ...NATIONAL_SOURCES,
  ...Object.values(TEAM_SOURCES).flat(),
  ...DATA_PROVIDER_SOURCES,
  ...RESEARCH_SOURCE_ADDITIONS,
];

export type { SourceCategory, SourceDefinition, SourcePlatform } from './types';
