import { KC_MONITORING_SOURCES } from './kc';

const sourcesByTeam = { KC: KC_MONITORING_SOURCES } satisfies Record<
  string,
  typeof KC_MONITORING_SOURCES
>;
export const getMonitoringSources = (teamId: string) =>
  sourcesByTeam[teamId.toUpperCase() as keyof typeof sourcesByTeam] ?? [];
