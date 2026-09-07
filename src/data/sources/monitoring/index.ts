import { KC_MONITORING_SOURCES } from './kc';

const sourcesByTeam = { KC: KC_MONITORING_SOURCES } satisfies Record<
  string,
  typeof KC_MONITORING_SOURCES
>;

export const getMonitoringTeamIds = () => Object.keys(sourcesByTeam);

export const getMonitoringSources = (teamId: string) =>
  sourcesByTeam[teamId.toUpperCase() as keyof typeof sourcesByTeam] ?? [];

export const getAllMonitoringSources = () => {
  const unique = new Map<string, (typeof KC_MONITORING_SOURCES)[number]>();
  for (const sources of Object.values(sourcesByTeam)) {
    for (const source of sources) unique.set(source.id, source);
  }
  return [...unique.values()];
};
