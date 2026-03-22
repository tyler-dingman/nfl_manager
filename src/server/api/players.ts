import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';
import type { FreeAgencyMarketDTO } from '@/types/free-agency';

import {
  filterPlayers,
  getProjectedRosterForTeam,
  getSaveStateResult,
  cutPlayerInState,
  offerContractInState,
  signFreeAgentInState,
  getFreeAgencyMarket as getFreeAgencyMarketFromState,
  advanceFreeAgencyWaveInState,
  type SaveResult,
  type PlayerFilters,
} from './store';

export type { PlayerFilters } from './store';

const toPlayerListRow = (player: PlayerRowDTO): PlayerRowDTO => ({
  id: player.id,
  firstName: player.firstName,
  lastName: player.lastName,
  teamAbbr: player.teamAbbr ?? null,
  normalizedName: player.normalizedName,
  position: player.position,
  age: player.age,
  height: player.height ?? null,
  weight: player.weight ?? null,
  baselineRating: player.baselineRating ?? null,
  maddenRating: player.maddenRating ?? null,
  marketValue: player.marketValue ?? null,
  rating: player.rating,
  contractYearsRemaining: player.contractYearsRemaining,
  capHit: player.capHit,
  capHitValue: player.capHitValue,
  salary: player.salary,
  guaranteed: player.guaranteed,
  deadCap: player.deadCap,
  releaseSavings: player.releaseSavings,
  postJune1Savings: player.postJune1Savings,
  status: player.status,
  headshotUrl: player.headshotUrl ?? null,
  signedTeamAbbr: player.signedTeamAbbr ?? null,
  signedTeamLogoUrl: player.signedTeamLogoUrl ?? null,
  signedAt: player.signedAt ?? null,
  cutAt: player.cutAt ?? null,
  lastTeamAbbr: player.lastTeamAbbr ?? null,
  currentTeamAbbr: player.currentTeamAbbr ?? null,
  contractStatus: player.contractStatus ?? null,
  isUnsigned: player.isUnsigned,
  averagePerYear: player.averagePerYear ?? null,
  expectedAnnualValue: player.freeAgentProfile?.expectedAnnualValue ?? player.expectedAnnualValue,
  originalAskAnnualValue: player.originalAskAnnualValue ?? null,
  currentAskAnnualValue: player.currentAskAnnualValue ?? null,
  askReductionAmount: player.askReductionAmount ?? null,
  askReductionPct: player.askReductionPct ?? null,
  signedWave: player.signedWave ?? null,
  isSignedByUser: player.isSignedByUser ?? false,
  isSignedByCpu: player.isSignedByCpu ?? false,
  marketTier: player.freeAgentProfile?.marketTier ?? player.marketTier,
  marketStatus: player.freeAgentProfile?.marketStatus ?? player.marketStatus,
  availabilityStatus: player.freeAgentProfile?.availabilityStatus ?? player.availabilityStatus,
  contract: player.contract,
});

export const getRoster = (
  saveId: string,
  filters?: PlayerFilters,
  teamAbbr?: string,
): SaveResult<PlayerRowDTO[]> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  const roster = getProjectedRosterForTeam(
    stateResult.data,
    (teamAbbr ?? stateResult.data.header.teamAbbr).toUpperCase(),
  );
  return { ok: true, data: filterPlayers(roster, filters).map(toPlayerListRow) };
};

export const getFreeAgents = (
  saveId: string,
  filters?: PlayerFilters,
): SaveResult<PlayerRowDTO[]> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  return {
    ok: true,
    data: filterPlayers(stateResult.data.freeAgents, filters).map(toPlayerListRow),
  };
};

export const getFreeAgencyMarket = (
  saveId: string,
  filters?: PlayerFilters,
): SaveResult<FreeAgencyMarketDTO> => {
  const result = getFreeAgencyMarketFromState(saveId, filters);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      ...result.data,
      players: result.data.players.map(toPlayerListRow),
    },
  };
};

export const advanceFreeAgencyWave = (
  saveId: string,
): SaveResult<{ header: SaveHeaderDTO; market: FreeAgencyMarketDTO }> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  const result = advanceFreeAgencyWaveInState(stateResult.data);
  return {
    ok: true,
    data: {
      header: result.header,
      market: {
        ...result.market,
        players: result.market.players.map(toPlayerListRow),
      },
    },
  };
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

export const cutPlayer = (
  saveId: string,
  playerId: string,
): SaveResult<{ header: SaveHeaderDTO; player: PlayerRowDTO }> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  return { ok: true, data: cutPlayerInState(stateResult.data, playerId) };
};

export const offerContract = (
  saveId: string,
  playerId: string,
  years: number,
  apy: number,
  guaranteed: number,
): SaveResult<{ header: SaveHeaderDTO; player: PlayerRowDTO }> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  return {
    ok: true,
    data: offerContractInState(stateResult.data, playerId, years, apy, guaranteed),
  };
};
