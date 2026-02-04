import { create } from 'zustand';

import type { SaveHeaderDTO } from '@/types/save';

type SaveStoreState = {
  saveId: string;
  teamId: string;
  teamAbbr: string;
  capSpace: number;
  capLimit: number;
  rosterCount: number;
  rosterLimit: number;
  phase: string;
  activeDraftSessionId: string | null;
  setSaveHeader: (header: SaveHeaderDTO, teamId?: string) => void;
  setActiveDraftSessionId: (sessionId: string | null) => void;
  refreshSaveHeader: () => Promise<void>;
};

const DEFAULT_STATE = {
  saveId: '',
  teamId: '',
  teamAbbr: '',
  capSpace: 0,
  capLimit: 0,
  rosterCount: 0,
  rosterLimit: 0,
  phase: 'free_agency',
  activeDraftSessionId: null,
};

export const useSaveStore = create<SaveStoreState>((set, get) => ({
  ...DEFAULT_STATE,
  setSaveHeader: (header, teamId) =>
    set((state) => ({
      ...state,
      saveId: header.id,
      teamId: teamId ?? state.teamId,
      teamAbbr: header.teamAbbr,
      capSpace: header.capSpace,
      capLimit: header.capLimit,
      rosterCount: header.rosterCount,
      rosterLimit: header.rosterLimit,
      phase: header.phase,
    })),
  setActiveDraftSessionId: (sessionId) => set({ activeDraftSessionId: sessionId }),
  refreshSaveHeader: async () => {
    const { saveId } = get();
    if (!saveId) {
      return;
    }

    const response = await fetch(`/api/saves/header?saveId=${saveId}`);
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as SaveHeaderDTO;
    set((state) => ({
      ...state,
      saveId: data.id,
      teamAbbr: data.teamAbbr,
      capSpace: data.capSpace,
      capLimit: data.capLimit,
      rosterCount: data.rosterCount,
      rosterLimit: data.rosterLimit,
      phase: data.phase,
    }));
  },
}));
