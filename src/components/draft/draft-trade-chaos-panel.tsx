'use client';

import { Clock3, PhoneCall, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TradeOfferDTO } from '@/types/trade-offers';

type DraftTradeChaosPanelProps = {
  offers: Array<TradeOfferDTO & { expiresAt: number }>;
  now: number;
  onReview: (offer: TradeOfferDTO) => void;
  onDecline: (offerId: string) => void;
  onDismiss: (offerId: string) => void;
};

const fairnessTone = (score: number) => {
  if (score >= 1.09) return 'text-emerald-700';
  if (score >= 0.82) return 'text-amber-700';
  return 'text-rose-700';
};

const fairnessTrack = (score: number) => {
  if (score >= 1.09) return 'bg-emerald-500';
  if (score >= 0.82) return 'bg-amber-400';
  return 'bg-rose-500';
};

const formatExpiry = (expiresAt: number, now: number) =>
  `${Math.max(0, Math.ceil((expiresAt - now) / 1000))}s`;

export function DraftTradeChaosPanel({
  offers,
  now,
  onReview,
  onDecline,
  onDismiss,
}: DraftTradeChaosPanelProps) {
  if (offers.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Live Trade Chaos
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Incoming calls</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
            <PhoneCall className="h-3.5 w-3.5" />
            Offers expire quickly
          </div>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:p-5 xl:grid-cols-2">
        {offers.map((offer) => {
          const secondsLeft = Math.max(0, Math.ceil((offer.expiresAt - now) / 1000));
          const meterWidth = Math.max(
            8,
            Math.min(100, (Math.min(1.2, offer.aiInterest.score) / 1.2) * 100),
          );
          return (
            <div key={offer.id} className="rounded-2xl border border-border bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{offer.proposingTeamName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{offer.summary}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-white hover:text-foreground"
                  onClick={() => onDismiss(offer.id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{offer.archetype.replace(/_/g, ' ')}</Badge>
                <Badge variant="secondary">Pick-for-pick value live</Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    You Give
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-foreground">
                    {offer.outgoing.assets.map((asset) => (
                      <li key={asset.id}>{asset.type === 'pick' ? asset.label : asset.name}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    You Get
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-foreground">
                    {offer.incoming.assets.map((asset) => (
                      <li key={asset.id}>{asset.type === 'pick' ? asset.label : asset.name}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Offer feel</span>
                  <span className={cn('font-semibold', fairnessTone(offer.aiInterest.score))}>
                    {offer.aiInterest.label}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all',
                      fairnessTrack(offer.aiInterest.score),
                    )}
                    style={{ width: `${meterWidth}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button type="button" className="sm:flex-1" onClick={() => onReview(offer)}>
                  Review
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="sm:flex-1"
                  onClick={() => onDecline(offer.id)}
                >
                  Decline
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
