import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';

import {
  filterPlayers,
  getSaveStateResult,
  offerContractInState,
  signFreeAgentInState,
  type SaveResult,
  type PlayerFilters,
} from './store';

export type { PlayerFilters } from './store';

export const getRoster = (
  saveId: string,
  filters?: PlayerFilters,
): SaveResult<PlayerRowDTO[]> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  return { ok: true, data: filterPlayers(stateResult.data.roster, filters) };
};

export const getFreeAgents = (
  saveId: string,
  filters?: PlayerFilters,
): SaveResult<PlayerRowDTO[]> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  return { ok: true, data: filterPlayers(stateResult.data.freeAgents, filters) };
};

export const signFreeAgent = (
  saveId: string,
  playerId: string,
): SaveResult<{ header: SaveHeaderDTO; player: PlayerRowDTO }> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  return { ok: true, data: signFreeAgentInState(stateResult.data, playerId) };
};

export const offerContract = (
  saveId: string,
  playerId: string,
  years: number,
  apy: number,
): SaveResult<{ header: SaveHeaderDTO; player: PlayerRowDTO }> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  return {
    ok: true,
    data: offerContractInState(stateResult.data, playerId, years, apy),
  };
};
