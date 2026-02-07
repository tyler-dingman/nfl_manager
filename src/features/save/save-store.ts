import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SaveBootstrapDTO, SaveHeaderDTO, SaveUnlocksDTO } from '@/types/save';

type SaveStoreState = {
  saveId: string;
  teamId: string;
  teamAbbr: string;
  capSpace: number;
  capLimit: number;
  rosterCount: number;
  rosterLimit: number;
  phase: string;
  unlocked: SaveUnlocksDTO;
  activeDraftSessionId: string | null;
  activeDraftSessionIdsBySave: Record<string, string>;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setSaveHeader: (header: SaveHeaderDTO | SaveBootstrapDTO, teamId?: string) => void;
  setActiveTeam: (teamId: string, teamAbbr: string) => void;
  setActiveDraftSessionId: (sessionId: string | null, saveIdOverride?: string) => void;
  clearSave: () => void;
  setPhase: (phase: string) => Promise<void>;
  advancePhase: () => Promise<void>;
  refreshSaveHeader: () => Promise<void>;
  ensureSaveId: () => Promise<string | null>;
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
  unlocked: { freeAgency: false, draft: false },
  activeDraftSessionId: null,
  activeDraftSessionIdsBySave: {},
  hasHydrated: false,
};

const resolveUnlocks = (phase: string, current?: SaveUnlocksDTO): SaveUnlocksDTO => {
  const next: SaveUnlocksDTO = {
    freeAgency: current?.freeAgency ?? false,
    draft: current?.draft ?? false,
  };

  if (phase === 'free_agency' || phase === 'draft' || phase === 'season') {
    next.freeAgency = true;
  }
  if (phase === 'draft' || phase === 'season') {
    next.draft = true;
  }

  return next;
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
        const unlocked = resolveUnlocks(phase, header.unlocked);

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
          unlocked,
          activeDraftSessionId: state.activeDraftSessionIdsBySave[saveId] ?? null,
        }));
      },
      setHasHydrated: (value) => set((state) => ({ ...state, hasHydrated: value })),
      setActiveTeam: (teamId, teamAbbr) =>
        set((state) => ({
          ...state,
          teamId,
          teamAbbr,
        })),
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
          teamId: '',
          teamAbbr: '',
          capSpace: 0,
          capLimit: 0,
          rosterCount: 0,
          rosterLimit: 0,
          phase: 'resign_cut',
          unlocked: { freeAgency: false, draft: false },
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
          unlocked: resolveUnlocks(data.phase, data.unlocked),
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
          unlocked: resolveUnlocks(data.phase, data.unlocked),
          activeDraftSessionId: state.activeDraftSessionIdsBySave[data.saveId] ?? null,
        }));
      },
      ensureSaveId: async () => {
        const { saveId, teamId, teamAbbr } = get();
        let activeSaveId = saveId;

        if (activeSaveId) {
          const headerResponse = await fetch(`/api/saves/header?saveId=${activeSaveId}`);
          if (headerResponse.status === 404) {
            activeSaveId = '';
          } else if (headerResponse.ok) {
            const data = (await headerResponse.json()) as
              | SaveBootstrapDTO
              | { ok: false; error: string };
            if ('ok' in data && data.ok) {
              set((state) => ({
                ...state,
                saveId: data.saveId,
                teamAbbr: data.teamAbbr,
                capSpace: data.capSpace,
                capLimit: data.capLimit,
                rosterCount: data.rosterCount,
                rosterLimit: data.rosterLimit,
                phase: data.phase,
                unlocked: resolveUnlocks(data.phase, data.unlocked),
                activeDraftSessionId: state.activeDraftSessionIdsBySave[data.saveId] ?? null,
              }));
              return data.saveId;
            }
          }
        }

        if (!teamId && !teamAbbr) {
          return null;
        }

        const createResponse = await fetch('/api/saves/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: teamId || undefined, teamAbbr: teamAbbr || undefined }),
        });
        if (!createResponse.ok) {
          return null;
        }

        const data = (await createResponse.json()) as
          | SaveBootstrapDTO
          | { ok: false; error: string };
        if (!('ok' in data) || !data.ok) {
          return null;
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
          unlocked: resolveUnlocks(data.phase, data.unlocked),
          activeDraftSessionId: state.activeDraftSessionIdsBySave[data.saveId] ?? null,
        }));

        return data.saveId;
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
        unlocked: state.unlocked,
        activeDraftSessionId: state.activeDraftSessionId,
        activeDraftSessionIdsBySave: state.activeDraftSessionIdsBySave,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
