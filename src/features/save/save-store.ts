import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SaveBootstrapDTO, SaveHeaderDTO } from '@/types/save';

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
  setSaveHeader: (header: SaveHeaderDTO | SaveBootstrapDTO, teamId?: string) => void;
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

export const useSaveStore = create<SaveStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,
      setSaveHeader: (header, teamId) => {
        const saveId = 'saveId' in header ? header.saveId : header.id;
        const teamAbbr = header.teamAbbr;
        const capSpace = header.capSpace;
        const capLimit = header.capLimit;
        const rosterCount = header.rosterCount;
        const rosterLimit = header.rosterLimit;
        const phase = header.phase;

        return set((state) => ({
          ...state,
          saveId,
          teamId: teamId ?? state.teamId,
          teamAbbr,
          capSpace,
          capLimit,
          rosterCount,
          rosterLimit,
          phase,
        }));
      },
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

        const data = (await response.json()) as
          | SaveBootstrapDTO
          | {
              ok: false;
              error: string;
            };
        if (!('ok' in data) || !data.ok) {
          return;
        }
        set((state) => ({
          ...state,
          saveId: data.saveId,
          teamAbbr: data.teamAbbr,
          capSpace: data.capSpace,
          capLimit: data.capLimit,
          rosterCount: data.rosterCount,
          rosterLimit: data.rosterLimit,
          phase: data.phase,
        }));
      },
    }),
    {
      name: 'nfl-manager-save',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        saveId: state.saveId,
        teamId: state.teamId,
        teamAbbr: state.teamAbbr,
        activeDraftSessionId: state.activeDraftSessionId,
      }),
    },
  ),
);
