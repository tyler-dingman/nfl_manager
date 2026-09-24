'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  initialOwnership,
  ownershipReducer,
  ownershipMetrics,
  reportCard,
  type OwnershipAction,
  type OwnershipState,
} from './model';
type Store = {
  saves: Record<string, OwnershipState>;
  act: (key: string, year: number, week: number, action: OwnershipAction) => void;
};
export const useOwnershipStore = create<Store>()(
  persist(
    (set) => ({
      saves: {},
      act: (key, year, week, action) =>
        set((state) => {
          const previous = state.saves[key] ?? initialOwnership(year);
          let next = ownershipReducer(previous, action, year, week);
          const metrics = ownershipMetrics(next, year);
          const grades = reportCard(next, year);
          const snapshot = {
            year,
            value: metrics.value,
            fans: metrics.sentiment,
            grade: Math.round(grades.reduce((n, g) => n + g.score, 0) / grades.length),
            ...(next.snapshots?.[year]?.record ? { record: next.snapshots[year].record } : {}),
          };
          if (JSON.stringify(next.snapshots?.[year]) !== JSON.stringify(snapshot))
            next = { ...next, snapshots: { ...next.snapshots, [year]: snapshot } };
          return next === state.saves[key] ? state : { saves: { ...state.saves, [key]: next } };
        }),
    }),
    { name: 'dnd-ownership-v1' },
  ),
);
