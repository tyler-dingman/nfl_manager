import { randomUUID } from 'crypto';

import type { SaveHeaderDTO } from '@/types/save';

import {
  createSaveState,
  getSaveHeaderSnapshot,
  getSaveState,
  getSaveStateResult,
  setSavePhaseInState,
  type SaveResult,
} from './store';

const teamSaveIndex = new Map<string, string>();

const normalizeTeamAbbr = (teamId?: string, teamAbbr?: string): string | null => {
  if (teamAbbr) {
    return teamAbbr.toUpperCase();
  }

  if (teamId) {
    return teamId.toUpperCase();
  }

  return null;
};

export const ensureSave = (
  teamId?: string,
  teamAbbr?: string,
): { saveId: string; header: SaveHeaderDTO } => {
  const normalizedTeam = normalizeTeamAbbr(teamId, teamAbbr);
  if (!normalizedTeam) {
    const saveId = randomUUID();
    const state = createSaveState(saveId, 'GB');
    return { saveId, header: getSaveHeaderSnapshot(state) };
  }

  const existingSaveId = teamSaveIndex.get(normalizedTeam);
  if (existingSaveId) {
    const existingState = getSaveState(existingSaveId);
    if (existingState) {
      return { saveId: existingSaveId, header: getSaveHeaderSnapshot(existingState) };
    }
  }

  const saveId = randomUUID();
  const state = createSaveState(saveId, normalizedTeam);
  teamSaveIndex.set(normalizedTeam, saveId);
  return { saveId, header: getSaveHeaderSnapshot(state) };
};

export const createSave = (teamAbbr: string): SaveHeaderDTO => {
  const normalizedTeam = normalizeTeamAbbr(undefined, teamAbbr) ?? teamAbbr;
  const saveId = randomUUID();
  const state = createSaveState(saveId, normalizedTeam);
  teamSaveIndex.set(normalizedTeam, saveId);
  return getSaveHeaderSnapshot(state);
};

export const setSavePhase = (saveId: string, phase: string): SaveResult<SaveHeaderDTO> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  return { ok: true, data: setSavePhaseInState(stateResult.data, phase) };
};
export const getSaveHeader = (saveId: string): SaveResult<SaveHeaderDTO> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  return { ok: true, data: getSaveHeaderSnapshot(stateResult.data) };
};
