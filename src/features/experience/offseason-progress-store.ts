import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  applyProgressEvent,
  createEmptyOffseasonProgressSnapshot,
  type OffseasonProgressSnapshot,
  type OffseasonProgressStep,
} from '@/lib/offseason-progress';

type RecordProgressArgs = {
  saveId: string;
  step: OffseasonProgressStep;
  eventKey: string;
  points?: number;
  complete?: boolean;
  skipped?: boolean;
};

type OffseasonProgressStoreState = {
  bySave: Record<string, OffseasonProgressSnapshot>;
  recordEvent: (
    args: RecordProgressArgs,
  ) => { changed: boolean; stepJustCompleted: boolean; snapshot: OffseasonProgressSnapshot };
  resetSave: (saveId: string) => void;
};

const getSnapshotForSave = (
  bySave: Record<string, OffseasonProgressSnapshot>,
  saveId: string,
) => bySave[saveId] ?? createEmptyOffseasonProgressSnapshot();

export const useOffseasonProgressStore = create<OffseasonProgressStoreState>()(
  persist(
    (set, get) => ({
      bySave: {},
      recordEvent: (args) => {
        const currentSnapshot = getSnapshotForSave(get().bySave, args.saveId);
        const result = applyProgressEvent(currentSnapshot, {
          step: args.step,
          eventKey: args.eventKey,
          points: args.points,
          complete: args.complete,
          skipped: args.skipped,
        });

        if (!result.changed) {
          return { ...result, snapshot: currentSnapshot };
        }

        set((state) => ({
          bySave: {
            ...state.bySave,
            [args.saveId]: result.snapshot,
          },
        }));

        return result;
      },
      resetSave: (saveId) =>
        set((state) => {
          const next = { ...state.bySave };
          delete next[saveId];
          return { bySave: next };
        }),
    }),
    {
      name: 'falco-offseason-progress',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ bySave: state.bySave }),
    },
  ),
);
