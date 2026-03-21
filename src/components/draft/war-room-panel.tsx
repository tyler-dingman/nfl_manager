'use client';

import { AdSlot } from '@/components/ads/AdSlot';
import { DraftTradeChaosPanel } from '@/components/draft/draft-trade-chaos-panel';
import { YourDraftSoFar } from '@/components/draft/your-draft-so-far';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DraftBoardEntry } from '@/lib/draft-board';
import type { DraftClassSummary, DraftRun } from '@/lib/draft-intelligence';
import type { DraftSessionDTO } from '@/types/draft';
import type { TradeOfferDTO } from '@/types/trade-offers';

type WarRoomPanelProps = {
  session: DraftSessionDTO;
  userTeamName: string;
  teamNeeds: string[];
  bestAvailableEntries: DraftBoardEntry[];
  activeRuns: DraftRun[];
  summary: DraftClassSummary;
  offers: Array<TradeOfferDTO & { expiresAt: number }>;
  now: number;
  onReviewOffer: (offer: TradeOfferDTO) => void;
  onDeclineOffer: (offerId: string) => void;
  onDismissOffer: (offerId: string) => void;
  onInspectPlayer: (playerId: string) => void;
};

export function WarRoomPanel({
  session,
  userTeamName,
  teamNeeds,
  bestAvailableEntries,
  activeRuns,
  summary,
  offers,
  now,
  onReviewOffer,
  onDeclineOffer,
  onDismissOffer,
  onInspectPlayer,
}: WarRoomPanelProps) {
  return (
    <aside className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          War Room
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">{userTeamName}</h2>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Team Needs
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {teamNeeds.slice(0, 5).map((need) => (
                <Badge key={need} variant="outline">
                  {need}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Best Available
            </p>
            <div className="mt-2 space-y-2">
              {bestAvailableEntries.length > 0 ? (
                bestAvailableEntries.map((entry) => (
                  <button
                    key={entry.player.id}
                    type="button"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300"
                    onClick={() => onInspectPlayer(entry.player.id)}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      #{entry.player.rank ?? '--'} {entry.player.firstName} {entry.player.lastName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.player.position} · OVR{' '}
                      {entry.player.rating ?? entry.player.maddenRating ?? '--'}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No top prospects available right now.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {activeRuns.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Decision Note
          </p>
          <p className="mt-2 text-sm font-semibold text-amber-900">{activeRuns[0].headline}</p>
          <p className="mt-2 text-sm text-amber-800">
            {activeRuns[0].count} {activeRuns[0].position} prospects have gone in the last {activeRuns[0].window} picks.
          </p>
        </section>
      ) : null}

      {offers.length > 0 ? (
        <div>
          <DraftTradeChaosPanel
            offers={offers}
            now={now}
            onReview={onReviewOffer}
            onDecline={onDeclineOffer}
            onDismiss={onDismissOffer}
          />
        </div>
      ) : null}

      <YourDraftSoFar summary={summary} />

      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Recommendation
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {bestAvailableEntries[0]
                ? `If you pass on ${bestAvailableEntries[0].player.firstName} ${bestAvailableEntries[0].player.lastName}, the board may not look this clean at your next turn.`
                : 'Stay flexible and trust the board if the room goes sideways.'}
            </p>
          </div>
          {bestAvailableEntries[0] ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onInspectPlayer(bestAvailableEntries[0].player.id)}
            >
              Scout
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-3 shadow-sm">
        <AdSlot placement="RIGHT_RAIL" />
      </section>
    </aside>
  );
}
