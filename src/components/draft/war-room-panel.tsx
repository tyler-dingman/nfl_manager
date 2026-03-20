'use client';

import { AdSlot } from '@/components/ads/AdSlot';
import { DraftTradeChaosPanel } from '@/components/draft/draft-trade-chaos-panel';
import { ProspectIndicators } from '@/components/draft/prospect-indicators';
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
  bestFit: DraftBoardEntry | null;
  bestAvailable: DraftBoardEntry | null;
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
  bestFit,
  bestAvailable,
  activeRuns,
  summary,
  offers,
  now,
  onReviewOffer,
  onDeclineOffer,
  onDismissOffer,
  onInspectPlayer,
}: WarRoomPanelProps) {
  const nextUserPicks = session.picks
    .filter(
      (pick) =>
        pick.ownerTeamAbbr === session.userTeamAbbr &&
        pick.overall > (session.picks[session.currentPickIndex]?.overall ?? 0) &&
        !pick.selectedPlayerId,
    )
    .slice(0, 3);

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
              Next Picks
            </p>
            <div className="mt-2 space-y-2">
              {nextUserPicks.length > 0 ? (
                nextUserPicks.map((pick) => (
                  <div key={pick.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    Round {pick.round} · Pick {pick.overall}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No additional picks in this window.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {bestFit ? (
        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Best Fit
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-300"
            onClick={() => onInspectPlayer(bestFit.player.id)}
          >
            <p className="text-base font-semibold text-foreground">
              {bestFit.player.firstName} {bestFit.player.lastName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {bestFit.player.position} · {bestFit.player.college ?? 'School TBD'}
            </p>
            <ProspectIndicators
              indicators={[
                { key: 'fit', label: 'Team Fit', tone: 'success' },
                ...(bestFit.tags.includes('Steal')
                  ? [{ key: 'steal', label: 'Steal', tone: 'success' as const }]
                  : []),
              ]}
              compact
              className="mt-3"
            />
          </button>
        </section>
      ) : null}

      {bestAvailable ? (
        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Best Available
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-300"
            onClick={() => onInspectPlayer(bestAvailable.player.id)}
          >
            <p className="text-base font-semibold text-foreground">
              {bestAvailable.player.firstName} {bestAvailable.player.lastName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {bestAvailable.player.position} · OVR {bestAvailable.player.rating ?? bestAvailable.player.maddenRating ?? '--'}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {bestAvailable.tags.includes('Steal')
                ? 'If you pass here, the room may view it as leaving real value on the table.'
                : 'Highest raw board value still available right now.'}
            </p>
          </button>
        </section>
      ) : null}

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
              {bestFit
                ? `If you pass on ${bestFit.player.firstName} ${bestFit.player.lastName}, this position may not look as clean by your next pick.`
                : 'Stay flexible and trust the board if the room goes sideways.'}
            </p>
          </div>
          {bestFit ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => onInspectPlayer(bestFit.player.id)}>
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
