import { randomUUID } from 'crypto';

import type { SaveHeaderDTO } from '@/types/save';

import { createSaveState, getSaveState } from './store';

export const createSave = (teamAbbr: string): SaveHeaderDTO => {
  const saveId = randomUUID();
  const state = createSaveState(saveId, teamAbbr);
  return state.header;
};

export const getSaveHeader = (saveId: string): SaveHeaderDTO => {
  const state = getSaveState(saveId);
  if (!state) {
    throw new Error('Save not found');
  }
  return state.header;
};
