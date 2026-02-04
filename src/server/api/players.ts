import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';

import {
  filterPlayers,
  getSaveState,
  offerContractInState,
  signFreeAgentInState,
  type PlayerFilters,
} from './store';

export type { PlayerFilters } from './store';

export const getRoster = (
  saveId: string,
  filters?: PlayerFilters,
): PlayerRowDTO[] => {
  const state = getSaveState(saveId);
  if (!state) {
    throw new Error('Save not found');
  }

  return filterPlayers(state.roster, filters);
};

export const getFreeAgents = (
  saveId: string,
  filters?: PlayerFilters,
): PlayerRowDTO[] => {
  const state = getSaveState(saveId);
  if (!state) {
    throw new Error('Save not found');
  }

  return filterPlayers(state.freeAgents, filters);
};

export const signFreeAgent = (
  saveId: string,
  playerId: string,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const state = getSaveState(saveId);
  if (!state) {
    throw new Error('Save not found');
  }

  return signFreeAgentInState(state, playerId);
};

export const offerContract = (
  saveId: string,
  playerId: string,
  years: number,
  apy: number,
): { header: SaveHeaderDTO; player: PlayerRowDTO } => {
  const state = getSaveState(saveId);
  if (!state) {
    throw new Error('Save not found');
  }

  return offerContractInState(state, playerId, years, apy);
};
