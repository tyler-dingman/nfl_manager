'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  createEmptyTradeOfferScope,
  registerTradeOfferDismissed,
  registerTradeOfferNotInterested,
  registerTradeOfferShown,
} from '@/features/trades/trade-toast-orchestrator';
import type { TradeOfferDTO, TradeOfferPhase } from '@/types/trade-offers';

type TradeOfferScopeState = ReturnType<typeof createEmptyTradeOfferScope>;

type TradeOfferStoreState = {
  activeOffer: TradeOfferDTO | null;
  reviewOffer: TradeOfferDTO | null;
  scopes: Record<string, TradeOfferScopeState>;
  getScope: (scopeKey: string) => TradeOfferScopeState;
  showOffer: (
    scopeKey: string,
    phase: TradeOfferPhase,
    offer: TradeOfferDTO,
    draftPickIndex?: number | null,
  ) => void;
  dismissOffer: (scopeKey: string, phase: TradeOfferPhase) => void;
  notInterested: (scopeKey: string, phase: TradeOfferPhase) => void;
  openReview: () => void;
  closeReview: () => void;
  clearActive: () => void;
};

const getStorage = () =>
  typeof window === 'undefined' ? undefined : createJSONStorage(() => window.sessionStorage);

export const useTradeOfferStore = create<TradeOfferStoreState>()(
  persist(
    (set, get) => ({
      activeOffer: null,
      reviewOffer: null,
      scopes: {},
      getScope: (scopeKey) => get().scopes[scopeKey] ?? createEmptyTradeOfferScope(),
      showOffer: (scopeKey, _phase, offer, draftPickIndex) =>
        set((state) => ({
          ...state,
          activeOffer: offer,
          scopes: {
            ...state.scopes,
            [scopeKey]: registerTradeOfferShown(
              state.scopes[scopeKey] ?? createEmptyTradeOfferScope(),
              offer,
              Date.now(),
              draftPickIndex,
            ),
          },
        })),
      dismissOffer: (scopeKey) =>
        set((state) => {
          const activeOffer = state.activeOffer;
          if (!activeOffer) return state;
          return {
            ...state,
            activeOffer: null,
            scopes: {
              ...state.scopes,
              [scopeKey]: registerTradeOfferDismissed(
                state.scopes[scopeKey] ?? createEmptyTradeOfferScope(),
                activeOffer,
              ),
            },
          };
        }),
      notInterested: (scopeKey) =>
        set((state) => {
          const activeOffer = state.activeOffer;
          if (!activeOffer) return state;
          return {
            ...state,
            activeOffer: null,
            reviewOffer: null,
            scopes: {
              ...state.scopes,
              [scopeKey]: registerTradeOfferNotInterested(
                state.scopes[scopeKey] ?? createEmptyTradeOfferScope(),
                activeOffer,
              ),
            },
          };
        }),
      openReview: () =>
        set((state) => ({
          ...state,
          reviewOffer: state.activeOffer,
        })),
      closeReview: () =>
        set((state) => ({
          ...state,
          reviewOffer: null,
        })),
      clearActive: () =>
        set((state) => ({
          ...state,
          activeOffer: null,
        })),
    }),
    {
      name: 'falco-trade-offers',
      storage: getStorage(),
      partialize: (state) => ({
        scopes: state.scopes,
      }),
    },
  ),
);
