import { TEAM_LIST } from '@/data/teams';
import {
  createSaveState,
  getOrBuildProjectedRosterForTeam,
  getProjectedCapSpaceForTeam,
} from '@/server/api/store';
/** For NEW franchises only. Never invoked as a fallback for legacy progress. */
export function initializeNewRuntime(saveId: string, team: string, year?: number) {
  const state = createSaveState(saveId, team, year);
  for (const t of TEAM_LIST) {
    getOrBuildProjectedRosterForTeam(state, t.abbr);
    state.teamCaps[t.abbr] = getProjectedCapSpaceForTeam(state, t.abbr);
  }
  return state;
}
