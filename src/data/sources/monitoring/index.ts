import { TEAM_LIST } from '@/data/teams';
import type { MonitoringSource } from '@/features/monitoring/types';
import { KC_MONITORING_SOURCES } from './kc';
import { buildTeamBaselineSources, NATIONAL_TIER_ONE_SOURCES } from './team-baselines';

const nationalSourceIds = new Set(NATIONAL_TIER_ONE_SOURCES.map((source) => source.id));

const sourcesByTeam: Record<string, MonitoringSource[]> = Object.fromEntries(
  TEAM_LIST.map((team) => [
    team.abbr,
    team.abbr === 'KC'
      ? KC_MONITORING_SOURCES.filter((source) => !nationalSourceIds.has(source.id))
      : buildTeamBaselineSources(team.abbr),
  ]),
);

export const getMonitoringTeamIds = () => Object.keys(sourcesByTeam);

export const getMonitoringSources = (teamId: string) => [
  ...(sourcesByTeam[teamId.toUpperCase()] ?? []),
  ...NATIONAL_TIER_ONE_SOURCES,
];

export const getAllMonitoringSources = () => {
  const unique = new Map<string, MonitoringSource>();
  for (const sources of Object.values(sourcesByTeam)) {
    for (const source of sources) unique.set(source.id, source);
  }
  for (const source of NATIONAL_TIER_ONE_SOURCES) unique.set(source.id, source);
  return [...unique.values()];
};
