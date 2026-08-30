import { DATA_PROVIDER_SOURCES } from './data-providers';
import { NATIONAL_SOURCES } from './national';
import { KC_SOURCES } from './teams/kc';
import type { SourceDefinition } from './types';

const TEAM_SOURCES: Record<string, SourceDefinition[]> = { KC: KC_SOURCES };

export const getSourcesForTeam = (teamId: string) => [
  ...NATIONAL_SOURCES,
  ...(TEAM_SOURCES[teamId.toUpperCase()] ?? []),
  ...DATA_PROVIDER_SOURCES,
];

export const getAllSources = () => [
  ...NATIONAL_SOURCES,
  ...Object.values(TEAM_SOURCES).flat(),
  ...DATA_PROVIDER_SOURCES,
];

export type { SourceCategory, SourceDefinition, SourcePlatform } from './types';
