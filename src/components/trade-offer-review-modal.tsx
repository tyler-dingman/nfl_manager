'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TradeOfferDTO, TradeOfferAssetDTO } from '@/types/trade-offers';

type TradeOfferReviewModalProps = {
  offer: TradeOfferDTO | null;
  open: boolean;
  onClose: () => void;
};

const interestToneClass = (score: number) => {
  if (score >= 1.09) return 'bg-emerald-50 text-emerald-700';
  if (score >= 0.95) return 'bg-sky-50 text-sky-700';
  if (score >= 0.82) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
};

const renderAssetMeta = (asset: TradeOfferAssetDTO) => {
  if (asset.type === 'pick') {
    return `${asset.year} R${asset.round}${asset.overallSlot ? ` · ${asset.overallSlot}` : ''}`;
  }
  return `${asset.position} · ${asset.age ?? '—'} yrs · ${asset.contractSummary}`;
};

export function TradeOfferReviewModal({ offer, open, onClose }: TradeOfferReviewModalProps) {
  if (!open || !offer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Incoming Trade Offer
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{offer.headline}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{offer.summary}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6">
          <div className="rounded-2xl border border-border bg-slate-50 px-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={offer.proposingTeamLogoUrl}
                  alt={offer.proposingTeamName}
                  className="h-10 w-10 object-contain"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">{offer.proposingTeamName}</p>
                  <p className="text-xs text-muted-foreground">{offer.reason}</p>
                </div>
              </div>
              <span
                className={cn(
                  'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                  interestToneClass(offer.userInterest.score),
                )}
              >
                {offer.userInterest.label}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {[offer.incoming, offer.outgoing].map((side, index) => (
              <div key={`${side.teamAbbr}-${index}`} className="rounded-2xl border border-border bg-white">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {index === 0 ? 'They Offer' : 'They Want'}
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">{side.teamName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{side.totalValue.toFixed(1)} pts</p>
                </div>
                <div className="space-y-3 px-4 py-4">
                  {side.assets.map((asset) => (
                    <div key={asset.id} className="rounded-xl border border-border px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {asset.type === 'pick' ? asset.label : asset.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {renderAssetMeta(asset)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {asset.projectedValuePoints.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border px-4 py-4 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
