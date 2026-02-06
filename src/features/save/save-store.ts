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
  activeDraftSessionIdsBySave: Record<string, string>;
  setSaveHeader: (header: SaveHeaderDTO | SaveBootstrapDTO, teamId?: string) => void;
  setActiveDraftSessionId: (sessionId: string | null, saveIdOverride?: string) => void;
  clearSave: () => void;
  setPhase: (phase: string) => Promise<void>;
  advancePhase: () => Promise<void>;
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
  phase: 'resign_cut',
  activeDraftSessionId: null,
  activeDraftSessionIdsBySave: {},
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
          activeDraftSessionId: state.activeDraftSessionIdsBySave[saveId] ?? null,
        }));
      },
      setActiveDraftSessionId: (sessionId, saveIdOverride) =>
        set((state) => {
          const targetSaveId = saveIdOverride ?? state.saveId;
          if (!targetSaveId) {
            return { ...state, activeDraftSessionId: sessionId };
          }

          const nextBySave = { ...state.activeDraftSessionIdsBySave };
          if (sessionId) {
            nextBySave[targetSaveId] = sessionId;
          } else {
            delete nextBySave[targetSaveId];
          }

          return {
            ...state,
            activeDraftSessionId: sessionId,
            activeDraftSessionIdsBySave: nextBySave,
          };
        }),
      clearSave: () =>
        set((state) => ({
          ...state,
          saveId: '',
          activeDraftSessionId: null,
          activeDraftSessionIdsBySave: {},
        })),
      setPhase: async (nextPhase) => {
        const { saveId } = get();
        if (!saveId) {
          return;
        }
        const response = await fetch('/api/saves/phase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ saveId, phase: nextPhase }),
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as SaveBootstrapDTO | { ok: false; error: string };
        if (!('ok' in data) || !data.ok) {
          return;
        }
        set((state) => ({
          ...state,
          phase: data.phase,
        }));
      },
      advancePhase: async () => {
        const { phase } = get();
        const nextPhase =
          phase === 'resign_cut'
            ? 'free_agency'
            : phase === 'free_agency'
              ? 'draft'
              : phase === 'draft'
                ? 'season'
                : 'season';
        await get().setPhase(nextPhase);
      },
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
          activeDraftSessionId: state.activeDraftSessionIdsBySave[data.saveId] ?? null,
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
        phase: state.phase,
        activeDraftSessionId: state.activeDraftSessionId,
        activeDraftSessionIdsBySave: state.activeDraftSessionIdsBySave,
      }),
    },
  ),
);
