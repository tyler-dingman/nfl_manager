'use client';

import * as React from 'react';

import TradeAssetPickerModal from '@/components/trade-asset-picker-modal';
import TradeAssetSlots, { type TradeSlotAsset } from '@/components/trade-asset-slots';
import { Button } from '@/components/ui/button';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PlayerRowDTO } from '@/types/player';
import type { TradeOfferAssetDTO, TradeOfferDTO } from '@/types/trade-offers';

type TradeOfferReviewModalProps = {
  offer: TradeOfferDTO | null;
  open: boolean;
  onClose: () => void;
};

type ExtraSelection =
  | { type: 'player'; id: string }
  | { type: 'pick'; id: string }
  | null;

type TradeOfferEvaluateResponse =
  | {
      ok: true;
      extraAssets: TradeOfferAssetDTO[];
      userInterest: TradeOfferDTO['userInterest'];
      aiInterest: TradeOfferDTO['aiInterest'];
      outgoingTotalValue: number;
    }
  | { ok: false; error: string };

const ACCEPT_MARK_SCORE = 0.95;
const MAX_METER_SCORE = 1.2;

const pickOptions = (teamAbbr: string) => [
  { id: '2026:r2:48', label: `2026 Round 2 Pick · ${teamAbbr}` },
  { id: '2026:r3:82', label: `2026 Round 3 Pick · ${teamAbbr}` },
  { id: '2026:r4:116', label: `2026 Round 4 Pick · ${teamAbbr}` },
  { id: '2026:r5:150', label: `2026 Round 5 Pick · ${teamAbbr}` },
  { id: '2027:r1', label: `2027 Round 1 Pick · ${teamAbbr}` },
  { id: '2027:r2', label: `2027 Round 2 Pick · ${teamAbbr}` },
];

const toSlotAsset = (asset: TradeOfferAssetDTO): TradeSlotAsset => ({
  id: asset.id,
  type: asset.type,
  label: asset.type === 'pick' ? asset.label : asset.name,
  sublabel:
    asset.type === 'pick'
      ? `${asset.year} R${asset.round}${asset.overallSlot ? ` · Pick ${asset.overallSlot}` : ''}`
      : `${asset.position} · ${asset.age ?? '—'} yrs`,
  meta:
    asset.type === 'pick'
      ? undefined
      : asset.contractSummary,
  headshotUrl: asset.type === 'player' ? asset.headshotUrl ?? null : null,
});

const pickSelectionIdToAssetId = (pickId: string, teamAbbr: string) => {
  const [yearToken, roundToken, overallToken] = pickId.split(':');
  const year = Number(yearToken);
  const round = Number(roundToken?.replace(/^r/i, ''));
  const overallSlot = overallToken ? Number(overallToken) : 0;

  if (!Number.isFinite(year) || !Number.isFinite(round)) {
    return null;
  }

  return `pick-${teamAbbr.toLowerCase()}-${year}-r${round}-${overallSlot}`;
};

const buildFallbackPlayerSlotAsset = (player: PlayerRowDTO): TradeSlotAsset => ({
  id: player.id,
  type: 'player',
  label: `${player.firstName} ${player.lastName}`,
  sublabel: `${player.position} · ${player.age ?? '—'} yrs`,
  meta:
    player.contract
      ? `${player.contract.yearsRemaining} yr · $${player.contract.apy.toFixed(1)}M`
      : player.capHit,
  headshotUrl: player.headshotUrl ?? null,
});

const buildFallbackPickSlotAsset = (pickId: string, teamAbbr: string): TradeSlotAsset => {
  const [yearToken, roundToken, overallToken] = pickId.split(':');
  const year = Number(yearToken);
  const round = Number(roundToken?.replace(/^r/i, '')) || 1;
  const overallSlot = overallToken ? Number(overallToken) : null;
  const label = pickOptions(teamAbbr).find((pick) => pick.id === pickId)?.label ?? pickId;

  return {
    id: pickId,
    type: 'pick',
    label,
    sublabel: `${year} R${round}${overallSlot ? ` · Pick ${overallSlot}` : ''}`,
  };
};

const interestToneClass = (score: number) => {
  if (score >= 1.09) return 'text-emerald-700';
  if (score >= 0.95) return 'text-sky-700';
  if (score >= 0.82) return 'text-amber-700';
  return 'text-rose-700';
};

const renderAssetMeta = (asset: TradeOfferAssetDTO) => {
  if (asset.type === 'pick') {
    return `${asset.year} R${asset.round}${asset.overallSlot ? ` · Pick ${asset.overallSlot}` : ''}`;
  }
  return `${asset.position} · ${asset.age ?? '—'} yrs · ${asset.contractSummary}`;
};

export function TradeOfferReviewModal({ offer, open, onClose }: TradeOfferReviewModalProps) {
  const saveId = useSaveStore((state) => state.saveId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const roster = useSaveStore((state) => state.roster);
  const [extraSelections, setExtraSelections] = React.useState<[ExtraSelection, ExtraSelection]>([
    null,
    null,
  ]);
  const [evaluatedExtraAssets, setEvaluatedExtraAssets] = React.useState<TradeOfferAssetDTO[]>([]);
  const [evaluatedAiInterest, setEvaluatedAiInterest] = React.useState<TradeOfferDTO['aiInterest'] | null>(null);
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = React.useState<number | null>(null);
  const [duplicateMessage, setDuplicateMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !offer) {
      setExtraSelections([null, null]);
      setEvaluatedExtraAssets([]);
      setEvaluatedAiInterest(null);
      setDuplicateMessage(null);
    }
  }, [offer, open]);

  React.useEffect(() => {
    if (!open || !offer || !saveId) return;

    const extraPlayerIds = extraSelections
      .filter((selection): selection is Extract<ExtraSelection, { type: 'player' }> => Boolean(selection && selection.type === 'player'))
      .map((selection) => selection.id);
    const extraPickIds = extraSelections
      .filter((selection): selection is Extract<ExtraSelection, { type: 'pick' }> => Boolean(selection && selection.type === 'pick'))
      .map((selection) => selection.id);

    if (extraPlayerIds.length === 0 && extraPickIds.length === 0) {
      setEvaluatedExtraAssets([]);
      setEvaluatedAiInterest(null);
      return;
    }

    let cancelled = false;
    const evaluate = async () => {
      const response = await apiFetch('/api/trade-offers/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId,
          offer,
          extraPlayerIds,
          extraPickIds,
        }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as TradeOfferEvaluateResponse;
      if (!data.ok || cancelled) return;
      setEvaluatedExtraAssets(data.extraAssets);
      setEvaluatedAiInterest(data.aiInterest);
    };

    void evaluate();
    return () => {
      cancelled = true;
    };
  }, [extraSelections, offer, open, saveId]);

  if (!open || !offer) return null;

  const currentAiInterest = evaluatedAiInterest ?? offer.aiInterest;
  const meterWidth = Math.max(
    0,
    Math.min(100, (currentAiInterest.score / MAX_METER_SCORE) * 100),
  );
  const acceptMarkLeft = (ACCEPT_MARK_SCORE / MAX_METER_SCORE) * 100;
  const selectedAssetIds = new Set(
    extraSelections.filter(Boolean).map((selection) => selection!.id),
  );
  const existingOutgoingPlayerIds = new Set(
    offer.outgoing.assets
      .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'player' }> => asset.type === 'player')
      .map((asset) => asset.playerId),
  );
  const availablePlayers = roster.filter(
    (player) => !existingOutgoingPlayerIds.has(player.id) && !selectedAssetIds.has(player.id),
  );
  const slotAssets: Array<TradeSlotAsset | null> = [0, 1].map((index) => {
    const selection = extraSelections[index];
    if (!selection) return null;

    if (selection.type === 'player') {
      const evaluatedAsset = evaluatedExtraAssets.find(
        (asset): asset is Extract<TradeOfferAssetDTO, { type: 'player' }> =>
          asset.type === 'player' && asset.playerId === selection.id,
      );
      if (evaluatedAsset) {
        return toSlotAsset(evaluatedAsset);
      }

      const player = roster.find((entry) => entry.id === selection.id);
      return player ? buildFallbackPlayerSlotAsset(player) : null;
    }

    const evaluatedPickAssetId = pickSelectionIdToAssetId(selection.id, teamAbbr);
    const evaluatedAsset =
      evaluatedPickAssetId
        ? evaluatedExtraAssets.find(
            (asset): asset is Extract<TradeOfferAssetDTO, { type: 'pick' }> =>
              asset.type === 'pick' && asset.id === evaluatedPickAssetId,
          )
        : null;

    if (evaluatedAsset) {
      return toSlotAsset(evaluatedAsset);
    }

    return buildFallbackPickSlotAsset(selection.id, teamAbbr);
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
        <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={offer.proposingTeamLogoUrl}
                  alt={offer.proposingTeamName}
                  className="h-10 w-10 shrink-0 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{offer.proposingTeamName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{offer.reason}</p>
                </div>
                <span className={cn('text-sm font-semibold', interestToneClass(currentAiInterest.score))}>
                  {currentAiInterest.label}
                </span>
              </div>

              <div className="mt-4 rounded-xl bg-white/80 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Acceptance Meter</span>
                  <span className={cn('font-semibold', interestToneClass(currentAiInterest.score))}>
                    {currentAiInterest.label}
                  </span>
                </div>
                <div className="relative mt-2 h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${meterWidth}%` }}
                  />
                  <div
                    className="absolute top-0 h-2 w-[2px] bg-slate-800"
                    style={{ left: `${acceptMarkLeft}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Current</span>
                  <span>Accept</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {[offer.incoming, offer.outgoing].map((side, index) => (
                <div
                  key={`${side.teamAbbr}-${index}`}
                  className="rounded-2xl border border-border bg-white"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {index === 0 ? 'They Offer' : 'They Want'}
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">{side.teamName}</p>
                  </div>
                  <div className="space-y-3 px-4 py-4">
                    {side.assets.map((asset) => (
                      <div key={asset.id} className="rounded-xl border border-border px-3 py-3">
                        <p className="text-sm font-semibold text-foreground">
                          {asset.type === 'pick' ? asset.label : asset.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {renderAssetMeta(asset)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Sweeten The Deal
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add up to two more assets from your side to move the offer closer to the accept line.
              </p>
              <div className="mt-4">
                <TradeAssetSlots
                  title="Counter Package"
                  subtitle="Additional outgoing assets"
                  slots={slotAssets}
                  onAdd={(slotIndex) => {
                    setActiveSlotIndex(slotIndex);
                    setDuplicateMessage(null);
                    setIsPickerOpen(true);
                  }}
                  onReplace={(slotIndex) => {
                    setActiveSlotIndex(slotIndex);
                    setDuplicateMessage(null);
                    setIsPickerOpen(true);
                  }}
                  onRemove={(slotIndex) => {
                    setExtraSelections((prev) => {
                      const next: [ExtraSelection, ExtraSelection] = [...prev] as [ExtraSelection, ExtraSelection];
                      next[slotIndex] = null;
                      return next;
                    });
                  }}
                />
              </div>
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

      <TradeAssetPickerModal
        isOpen={isPickerOpen}
        title="Add outgoing asset"
        players={availablePlayers}
        picks={pickOptions(teamAbbr)}
        duplicateMessage={duplicateMessage}
        onClose={() => {
          setIsPickerOpen(false);
          setActiveSlotIndex(null);
        }}
        onSelectPlayer={(player) => {
          if (selectedAssetIds.has(player.id)) {
            setDuplicateMessage('That asset is already in the counter package.');
            return;
          }
          if (activeSlotIndex === null) return;
          setExtraSelections((prev) => {
            const next: [ExtraSelection, ExtraSelection] = [...prev] as [ExtraSelection, ExtraSelection];
            next[activeSlotIndex] = { type: 'player', id: player.id };
            return next;
          });
        }}
        onSelectPick={(pickId) => {
          if (selectedAssetIds.has(pickId)) {
            setDuplicateMessage('That asset is already in the counter package.');
            return;
          }
          if (activeSlotIndex === null) return;
          setExtraSelections((prev) => {
            const next: [ExtraSelection, ExtraSelection] = [...prev] as [ExtraSelection, ExtraSelection];
            next[activeSlotIndex] = { type: 'pick', id: pickId };
            return next;
          });
        }}
      />
    </>
  );
}
