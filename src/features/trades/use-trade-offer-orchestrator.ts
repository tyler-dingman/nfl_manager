'use client';

import { useCallback } from 'react';

import { apiFetch } from '@/lib/api';
import {
  shouldRequestTradeOffer,
  TRADE_OFFER_COOLDOWN_MS,
  createEmptyTradeOfferScope,
  TRADE_OFFER_LIMITS,
} from '@/features/trades/trade-toast-orchestrator';
import { useTradeOfferStore } from '@/features/trades/trade-offer-store';
import type { TradeOfferDTO, TradeOfferPhase } from '@/types/trade-offers';

type TradeOfferApiResponse =
  | {
      ok: true;
      offers: TradeOfferDTO[];
      debug?: unknown;
    }
  | { ok: false; error: string };

type UseTradeOfferOrchestratorParams = {
  enabled: boolean;
  phase: TradeOfferPhase;
  saveId: string;
  teamAbbr: string;
  ensureActionableSaveId: (preferredSaveId?: string | null) => Promise<string | null>;
};

export const useTradeOfferOrchestrator = ({
  enabled,
  phase,
  saveId,
  teamAbbr,
  ensureActionableSaveId,
}: UseTradeOfferOrchestratorParams) => {
  const showOffer = useTradeOfferStore((state) => state.showOffer);

  return useCallback(
    async ({
      trigger,
      draftSessionId,
      draftCurrentPickIndex,
      force = false,
    }: {
      trigger: string;
      draftSessionId?: string | null;
      draftCurrentPickIndex?: number | null;
      force?: boolean;
    }) => {
      if (!enabled || !saveId || !teamAbbr) return false;

      const scopeKey = `${saveId}:${phase}`;
      const scope =
        useTradeOfferStore.getState().scopes[scopeKey] ?? createEmptyTradeOfferScope();

      if (
        (force && scope.shownCount >= TRADE_OFFER_LIMITS[phase]) ||
        (!force &&
          !shouldRequestTradeOffer({
            phase,
            scope,
            currentDraftPickIndex: draftCurrentPickIndex,
            now: Date.now(),
          }))
      ) {
        return false;
      }

      const actionableSaveId = await ensureActionableSaveId(saveId);
      if (!actionableSaveId) {
        return false;
      }

      const response = await apiFetch('/api/trade-offers/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId: actionableSaveId,
          userTeamAbbr: teamAbbr,
          phase,
          trigger,
          shownOfferIds: scope.shownOfferIds,
          mutedTeamAbbrs: scope.mutedTeamAbbrs,
          draftSessionId,
          draftCurrentPickIndex,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as TradeOfferApiResponse;
      if (!data.ok || data.offers.length === 0) {
        return false;
      }

      const nextOffer =
        data.offers.find(
          (offer) =>
            !scope.shownOfferIds.includes(offer.id) &&
            !scope.mutedTeamAbbrs.includes(offer.proposingTeamAbbr),
        ) ?? data.offers[0];

      showOffer(scopeKey, phase, nextOffer, draftCurrentPickIndex);

      if (process.env.NODE_ENV !== 'production') {
        console.info('[trade-offers] shown', {
          phase,
          trigger,
          offerId: nextOffer.id,
          cooldownMs: TRADE_OFFER_COOLDOWN_MS[phase],
        });
      }

      return true;
    },
    [enabled, ensureActionableSaveId, phase, saveId, showOffer, teamAbbr],
  );
};
