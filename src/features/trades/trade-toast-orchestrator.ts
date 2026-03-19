import type { TradeOfferDTO, TradeOfferPhase } from '@/types/trade-offers';

export const TRADE_OFFER_LIMITS: Record<TradeOfferPhase, number> = {
  manage: 2,
  freeAgency: 2,
  draft: 4,
};

export const TRADE_OFFER_COOLDOWN_MS: Record<TradeOfferPhase, number> = {
  manage: 45_000,
  freeAgency: 45_000,
  draft: 20_000,
};

export const TRADE_OFFER_DRAFT_PICK_COOLDOWN = 4;

type ScopeState = {
  shownOfferIds: string[];
  shownCount: number;
  mutedTeamAbbrs: string[];
  lastShownAt: number;
  lastDraftPickIndex: number | null;
};

export const createEmptyTradeOfferScope = (): ScopeState => ({
  shownOfferIds: [],
  shownCount: 0,
  mutedTeamAbbrs: [],
  lastShownAt: 0,
  lastDraftPickIndex: null,
});

export const shouldRequestTradeOffer = ({
  phase,
  scope,
  currentDraftPickIndex,
  now = Date.now(),
}: {
  phase: TradeOfferPhase;
  scope: ScopeState;
  currentDraftPickIndex?: number | null;
  now?: number;
}) => {
  if (scope.shownCount >= TRADE_OFFER_LIMITS[phase]) {
    return false;
  }

  if (phase === 'draft') {
    if (scope.lastDraftPickIndex === null || currentDraftPickIndex === null) {
      return true;
    }
    const safeCurrentDraftPickIndex = currentDraftPickIndex ?? scope.lastDraftPickIndex;
    return (
      safeCurrentDraftPickIndex - scope.lastDraftPickIndex >= TRADE_OFFER_DRAFT_PICK_COOLDOWN
    );
  }

  return now - scope.lastShownAt >= TRADE_OFFER_COOLDOWN_MS[phase];
};

export const registerTradeOfferShown = (
  scope: ScopeState,
  offer: TradeOfferDTO,
  shownAt = Date.now(),
  draftPickIndex?: number | null,
): ScopeState => ({
  shownOfferIds: Array.from(new Set([...scope.shownOfferIds, offer.id])),
  shownCount: scope.shownCount + 1,
  mutedTeamAbbrs: scope.mutedTeamAbbrs,
  lastShownAt: shownAt,
  lastDraftPickIndex: draftPickIndex ?? scope.lastDraftPickIndex,
});

export const registerTradeOfferDismissed = (scope: ScopeState, offer: TradeOfferDTO): ScopeState => ({
  ...scope,
  shownOfferIds: Array.from(new Set([...scope.shownOfferIds, offer.id])),
});

export const registerTradeOfferNotInterested = (
  scope: ScopeState,
  offer: TradeOfferDTO,
): ScopeState => ({
  ...scope,
  shownOfferIds: Array.from(new Set([...scope.shownOfferIds, offer.id])),
  mutedTeamAbbrs: Array.from(new Set([...scope.mutedTeamAbbrs, offer.proposingTeamAbbr])),
});
