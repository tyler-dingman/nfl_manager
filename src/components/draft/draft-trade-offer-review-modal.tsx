'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { useToast } from '@/components/ui/toast';
import { buildStarReactionToastPayload } from '@/lib/star-player-reaction';
import { generateChainReactionEffects } from '@/lib/chain-reaction-effects';
import { OFFSEASON_PROGRESS_POINTS } from '@/lib/offseason-progress';
import { apiFetch } from '@/lib/api';
import type { PlayerRowDTO } from '@/types/player';
import type { TradeOfferAssetDTO, TradeOfferDTO } from '@/types/trade-offers';

type DraftTradeOfferReviewModalProps = {
  offer: TradeOfferDTO | null;
  open: boolean;
  draftSessionId: string;
  onClose: () => void;
  onAccepted: (payload: {
    session: import('@/types/draft').DraftSessionDTO;
    roster: PlayerRowDTO[];
    header: {
      saveId: string;
      teamAbbr: string;
      capSpace: number;
      capLimit: number;
      rosterCount: number;
      rosterLimit: number;
      phase: string;
      unlocked: { freeAgency: boolean; draft: boolean };
      createdAt: string;
    };
  }) => void;
};

type AcceptDraftTradeResponse =
  | {
      ok: true;
      accepted: true;
      session: import('@/types/draft').DraftSessionDTO;
      roster: PlayerRowDTO[];
      header: {
        saveId: string;
        teamAbbr: string;
        capSpace: number;
        capLimit: number;
        rosterCount: number;
        rosterLimit: number;
        phase: string;
        unlocked: { freeAgency: boolean; draft: boolean };
        createdAt: string;
      };
    }
  | { ok: true; accepted: false; error: string }
  | { ok: false; error: string };

const interestBarClass = (score: number) => {
  if (score >= 1.09) return 'bg-emerald-500';
  if (score >= 0.82) return 'bg-amber-400';
  return 'bg-rose-500';
};

const interestLabel = (score: number) => {
  if (score >= 1.09) return 'High interest';
  if (score >= 0.82) return 'Medium interest';
  return 'Low interest';
};

const DraftPickCard = ({ asset }: { asset: Extract<TradeOfferAssetDTO, { type: 'pick' }> }) => (
  <div className="rounded-xl border border-border px-3 py-3">
    <p className="text-sm font-semibold text-foreground">{asset.label}</p>
    <p className="mt-1 text-xs text-muted-foreground">
      {asset.year} R{asset.round}
      {asset.overallSlot ? ` · Pick ${asset.overallSlot}` : ''}
    </p>
  </div>
);

const PlayerCard = ({ asset }: { asset: Extract<TradeOfferAssetDTO, { type: 'player' }> }) => (
  <div className="rounded-xl border border-border px-3 py-3">
    <div className="flex items-center gap-3">
      {asset.headshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.headshotUrl}
          alt={asset.name}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
          {asset.name.charAt(0)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{asset.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {asset.position} · {asset.age ?? '—'} yrs · {asset.contractSummary}
        </p>
      </div>
    </div>
  </div>
);

const renderAsset = (asset: TradeOfferAssetDTO) =>
  asset.type === 'pick' ? <DraftPickCard key={asset.id} asset={asset} /> : <PlayerCard key={asset.id} asset={asset} />;

export function DraftTradeOfferReviewModal({
  offer,
  open,
  draftSessionId,
  onClose,
  onAccepted,
}: DraftTradeOfferReviewModalProps) {
  const saveId = useSaveStore((state) => state.saveId);
  const roster = useSaveStore((state) => state.roster);
  const capSpace = useSaveStore((state) => state.capSpace);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const selectedTeamName = useTeamStore(
    (state) => state.teams.find((team) => team.id === state.selectedTeamId)?.name ?? teamAbbr,
  );
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);
  const { push: pushToast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setMessage(null);
    }
  }, [open]);

  if (!open || !offer || !saveId) return null;

  const interestScore = offer.aiInterest.score;
  const meterWidth = Math.max(8, Math.min(100, (Math.min(1.2, interestScore) / 1.2) * 100));

  const handleAccept = async () => {
    setSubmitting(true);
    setMessage(null);

    const response = await apiFetch('/api/draft/trade-offers/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId,
        draftSessionId,
        offer,
      }),
    });

    const data = (await response.json()) as AcceptDraftTradeResponse;
    if (!response.ok || !data.ok) {
      setMessage(data.ok ? 'Unable to process this trade.' : data.error);
      setSubmitting(false);
      return;
    }

    if (!data.accepted) {
      setMessage(data.error);
      setSubmitting(false);
      return;
    }

    const previousRoster = roster;
    const acquiredPlayerIds = new Set(
      offer.incoming.assets
        .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'player' }> => asset.type === 'player')
        .map((asset) => asset.playerId),
    );
    const acquiredPlayer = data.roster.find((player) => acquiredPlayerIds.has(player.id)) ?? null;

    if (acquiredPlayer) {
      const starToast = buildStarReactionToastPayload({
        incomingPlayer: acquiredPlayer,
        roster: data.roster,
        actionType: 'trade',
        teamAbbr,
        teamName: selectedTeamName,
      });
      if (starToast) {
        pushToast({
          id: `star-reaction:draft-trade:${saveId}:${offer.id}:${acquiredPlayer.id}`,
          kind: 'starReaction',
          durationMs: 5200,
          starReaction: starToast,
        });
      }

      const chainReaction = generateChainReactionEffects({
        beforeRoster: previousRoster,
        afterRoster: data.roster,
        beforeCapSpace: capSpace,
        afterCapSpace: data.header.capSpace,
        moveType: 'trade',
        player: acquiredPlayer,
      });
      if (chainReaction) {
        pushToast({
          id: `chain-reaction:draft-trade:${saveId}:${offer.id}:${acquiredPlayer.id}`,
          kind: 'chainReaction',
          durationMs: 5600,
          chainReaction: {
            title: 'Ripple Effects',
            subtitle: 'What this draft-day trade changes',
            effects: chainReaction.effects.map((effect) => effect.message),
          },
        });
      }
    }

    const progressResult = recordProgressEvent({
      saveId,
      step: 'draft',
      eventKey: `draft-trade-accepted:${offer.id}`,
      points: OFFSEASON_PROGRESS_POINTS.draft.trade_response,
    });
    if (progressResult.changed) {
      pushToast({
        id: `progress:${saveId}:draft-trade-accepted:${offer.id}`,
        kind: 'progress',
        durationMs: 3400,
        progress: {
          message: 'Handled a live draft trade and stayed flexible on the clock.',
          detail: 'Draft',
        },
      });
    }

    onAccepted({
      session: data.session,
      roster: data.roster,
      header: data.header,
    });
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Draft Day Trade
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{offer.proposingTeamName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{offer.reason}</p>
              </div>
              <span className="text-sm font-semibold text-foreground">{interestLabel(interestScore)}</span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
              <div
                className={`h-2 rounded-full transition-all ${interestBarClass(interestScore)}`}
                style={{ width: `${meterWidth}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  You Send
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{offer.outgoing.teamName}</p>
              </div>
              <div className="space-y-3 px-4 py-4">{offer.outgoing.assets.map(renderAsset)}</div>
            </div>

            <div className="rounded-2xl border border-border bg-white">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  You Receive
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{offer.incoming.teamName}</p>
              </div>
              <div className="space-y-3 px-4 py-4">{offer.incoming.assets.map(renderAsset)}</div>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-4 py-4 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-[20px] text-sm text-muted-foreground">{message}</div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" onClick={handleAccept} disabled={submitting}>
                {submitting ? 'Accepting...' : 'Accept Trade'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Decline
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
