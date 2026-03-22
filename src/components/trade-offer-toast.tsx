'use client';

import { Button } from '@/components/ui/button';
import { useTradeOfferStore } from '@/features/trades/trade-offer-store';
import { TradeOfferReviewModal } from '@/components/trade-offer-review-modal';

type TradeOfferToastProps = {
  scopeKey: string | null;
};

export function TradeOfferToast({ scopeKey }: TradeOfferToastProps) {
  const activeOffer = useTradeOfferStore((state) => state.activeOffer);
  const reviewOffer = useTradeOfferStore((state) => state.reviewOffer);
  const dismissOffer = useTradeOfferStore((state) => state.dismissOffer);
  const notInterested = useTradeOfferStore((state) => state.notInterested);
  const openReview = useTradeOfferStore((state) => state.openReview);
  const closeReview = useTradeOfferStore((state) => state.closeReview);

  if (!activeOffer || !scopeKey) {
    return (
      <TradeOfferReviewModal
        offer={reviewOffer}
        open={Boolean(reviewOffer)}
        onClose={closeReview}
      />
    );
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeOffer.proposingTeamLogoUrl}
              alt={activeOffer.proposingTeamName}
              className="mt-0.5 h-10 w-10 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Trade Offer
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{activeOffer.headline}</p>
              <p className="mt-1 text-sm text-muted-foreground">{activeOffer.summary}</p>
              <p className="mt-2 text-xs text-muted-foreground">{activeOffer.reason}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => dismissOffer(scopeKey, activeOffer.phase)}
          >
            ✕
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="sm:flex-1" onClick={openReview}>
            Review
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="sm:flex-1"
            onClick={() => notInterested(scopeKey, activeOffer.phase)}
          >
            Not Interested
          </Button>
        </div>
      </div>
      <TradeOfferReviewModal
        offer={reviewOffer}
        open={Boolean(reviewOffer)}
        onClose={closeReview}
      />
    </>
  );
}
