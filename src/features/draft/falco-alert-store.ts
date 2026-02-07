import { create } from 'zustand';

import type { FalcoAlertType } from '@/features/draft/falco-quotes';

export type FalcoAlertItem = {
  id: string;
  type: FalcoAlertType;
  message: string;
  title?: string;
  lines?: string[];
  createdAt: string;
};

type FalcoAlertState = {
  alertQueue: FalcoAlertItem[];
  history: FalcoAlertItem[];
  activeAlert: FalcoAlertItem | null;
  pushAlert: (alert: FalcoAlertItem) => void;
  dismissActive: () => void;
};

export const useFalcoAlertStore = create<FalcoAlertState>((set) => ({
  alertQueue: [],
  history: [],
  activeAlert: null,
  pushAlert: (alert) =>
    set((state) => {
      const nextQueue = [...state.alertQueue, alert];
      const nextHistory = [alert, ...state.history].slice(0, 10);
      return {
        alertQueue: nextQueue,
        activeAlert: state.activeAlert ?? nextQueue[0] ?? null,
        history: nextHistory,
      };
    }),
  dismissActive: () =>
    set((state) => {
      if (!state.activeAlert) return state;
      const [, ...rest] = state.alertQueue;
      return {
        alertQueue: rest,
        activeAlert: rest[0] ?? null,
        history: state.history,
      };
    }),
}));
