'use client';

import * as React from 'react';

import PlayerDetailsModal from '@/components/player-details-modal';
import PlayerTypeIcon from '@/components/player-type-icon';
import TradeAssetPickerModal from '@/components/trade-asset-picker-modal';
import TradeAssetSlots, { type TradeSlotAsset } from '@/components/trade-asset-slots';
import { Button } from '@/components/ui/button';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { useTradeOfferStore } from '@/features/trades/trade-offer-store';
import { apiFetch } from '@/lib/api';
import { generateChainReactionEffects } from '@/lib/chain-reaction-effects';
import { getPlayerTypeIndicator } from '@/lib/player-type-indicator';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';
import { dispatchSaveDataUpdated } from '@/lib/save-sync-events';
import { OFFSEASON_PROGRESS_POINTS } from '@/lib/offseason-progress';
import type { PlayerDetailsSource } from '@/lib/player-details';
import { buildStarReactionToastPayload } from '@/lib/star-player-reaction';
import { useToast } from '@/components/ui/toast';
import { resolvePlayerRating } from '@/lib/team-overview';
import { cn } from '@/lib/utils';
import type { PlayerRowDTO } from '@/types/player';
import type {
  TeamTradeAssetSourceDTO,
  TradeOfferAssetDTO,
  TradeOfferDTO,
  TradePickAssetDTO,
} from '@/types/trade-offers';

type TradeOfferReviewModalProps = {
  offer: TradeOfferDTO | null;
  open: boolean;
  onClose: () => void;
};

type ExtraSelection = { type: 'player'; id: string } | { type: 'pick'; id: string } | null;

type ExtraSide = 'incoming' | 'outgoing';

type ActivePickerContext = {
  side: ExtraSide;
  slotIndex: number;
};

type TradeOfferEvaluateResponse =
  | {
      ok: true;
      extraIncomingAssets: TradeOfferAssetDTO[];
      extraOutgoingAssets: TradeOfferAssetDTO[];
      userInterest: TradeOfferDTO['userInterest'];
      aiInterest: TradeOfferDTO['aiInterest'];
      incomingTotalValue: number;
      outgoingTotalValue: number;
      aiExplanation?: string;
    }
  | { ok: false; error: string };

type TradeOfferAssetsResponse =
  | {
      ok: true;
      user: TeamTradeAssetSourceDTO;
      partner: TeamTradeAssetSourceDTO;
    }
  | { ok: false; error: string };

type AcceptTradeOfferResponse =
  | {
      ok: true;
      accepted: true;
      header: {
        id: string;
        teamAbbr: string;
        capSpace: number;
        capLimit: number;
        rosterCount: number;
        rosterLimit: number;
        phase: string;
        unlocked: { freeAgency: boolean; draft: boolean };
        createdAt: string;
      };
      roster: PlayerRowDTO[];
      aiInterest: TradeOfferDTO['aiInterest'];
      partnerTeamAbbr: string;
    }
  | {
      ok: true;
      accepted: false;
      aiInterest: TradeOfferDTO['aiInterest'];
      error: string;
    }
  | { ok: false; error: string };

const MAX_METER_SCORE = 1.2;
const ADJUSTMENT_SLOT_COUNT = 3;
const NFL_DRAFT_LOGO_URL =
  'https://upload.wikimedia.org/wikipedia/en/thumb/8/80/NFL_Draft_logo.svg/500px-NFL_Draft_logo.svg.png';

const toSlotAsset = (asset: TradeOfferAssetDTO): TradeSlotAsset => ({
  id: asset.id,
  type: asset.type,
  label: asset.type === 'pick' ? asset.label : asset.name,
  sublabel:
    asset.type === 'pick'
      ? `${asset.year} R${asset.round}${asset.overallSlot ? ` · Pick ${asset.overallSlot}` : ''}`
      : `${asset.position} · ${asset.age ?? '—'} yrs`,
  meta: asset.type === 'pick' ? undefined : asset.contractSummary,
  headshotUrl: asset.type === 'player' ? (asset.headshotUrl ?? null) : null,
  playerTypeIndicator:
    asset.type === 'player'
      ? getPlayerTypeIndicator({ age: asset.age ?? undefined, rating: asset.rating ?? undefined })
      : null,
});

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
  playerTypeIndicator: getPlayerTypeIndicator(player),
});

const formatFallbackPickLabel = (pick: TradePickAssetDTO) => {
  if (pick.overallSlot) {
    return `${pick.year} Round ${pick.round} Pick · Pick ${pick.overallSlot}`;
  }
  return `${pick.year} Round ${pick.round} Pick · ${pick.originalTeamAbbr}`;
};

const buildFallbackPickSlotAsset = (pick: TradePickAssetDTO): TradeSlotAsset => {
  return {
    id: pick.id,
    type: 'pick',
    label: formatFallbackPickLabel(pick),
    sublabel: `${pick.year} R${pick.round}${pick.overallSlot ? ` · Pick ${pick.overallSlot}` : ''}`,
    meta: `${Math.round(pick.projectedValuePoints)} pts`,
  };
};

const interestToneClass = (score: number) => {
  if (score >= 1.09) return 'text-emerald-700';
  if (score >= 0.82) return 'text-amber-700';
  return 'text-rose-700';
};

const interestBarClass = (score: number) => {
  if (score >= 1.09) return 'bg-emerald-500';
  if (score >= 0.82) return 'bg-amber-400';
  return 'bg-rose-500';
};

const renderAssetMeta = (asset: TradeOfferAssetDTO) => {
  if (asset.type === 'pick') {
    return `${asset.year} R${asset.round}${asset.overallSlot ? ` · Pick ${asset.overallSlot}` : ` · ${asset.originalTeamAbbr}`} · ${Math.round(asset.projectedValuePoints)} pts`;
  }
  return `${asset.position} · ${asset.age ?? '—'} yrs · ${asset.contractSummary}`;
};

const renderAssetCard = (
  asset: TradeOfferAssetDTO,
  onOpenPlayer?: (asset: Extract<TradeOfferAssetDTO, { type: 'player' }>) => void,
) => (
  <div key={asset.id} className="rounded-xl border border-border px-3 py-3">
    {asset.type === 'player' ? (
      <button
        type="button"
        className="flex w-full items-center gap-3 text-left"
        onClick={() => onOpenPlayer?.(asset)}
      >
        <div className="shrink-0">
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
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{asset.name}</p>
            <PlayerTypeIcon
              indicator={getPlayerTypeIndicator({
                age: asset.age ?? undefined,
                rating: asset.rating ?? undefined,
              })}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{renderAssetMeta(asset)}</p>
        </div>
      </button>
    ) : (
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={NFL_DRAFT_LOGO_URL}
          alt="NFL Draft"
          className="h-10 w-10 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{asset.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{renderAssetMeta(asset)}</p>
        </div>
      </div>
    )}
  </div>
);

const buildSlotAssets = ({
  selections,
  evaluatedAssets,
  roster,
  draftPicks,
}: {
  selections: ExtraSelection[];
  evaluatedAssets: TradeOfferAssetDTO[];
  roster: PlayerRowDTO[];
  draftPicks: TradePickAssetDTO[];
}) =>
  selections.map((selection) => {
    if (!selection) return null;

    if (selection.type === 'player') {
      const evaluatedAsset = evaluatedAssets.find(
        (asset): asset is Extract<TradeOfferAssetDTO, { type: 'player' }> =>
          asset.type === 'player' && asset.playerId === selection.id,
      );
      if (evaluatedAsset) {
        return toSlotAsset(evaluatedAsset);
      }

      const player = roster.find((entry) => entry.id === selection.id);
      return player ? buildFallbackPlayerSlotAsset(player) : null;
    }

    const evaluatedAsset = evaluatedAssets.find(
      (asset): asset is Extract<TradeOfferAssetDTO, { type: 'pick' }> =>
        asset.type === 'pick' && asset.id === selection.id,
    );

    if (evaluatedAsset) {
      return toSlotAsset(evaluatedAsset);
    }

    const pick = draftPicks.find((entry) => entry.id === selection.id);
    return pick ? buildFallbackPickSlotAsset(pick) : null;
  });

export function TradeOfferReviewModal({ offer, open, onClose }: TradeOfferReviewModalProps) {
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const roster = useSaveStore((state) => state.roster);
  const phase = useSaveStore((state) => state.phase);
  const unlocked = useSaveStore((state) => state.unlocked);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const setRoster = useSaveStore((state) => state.setRoster);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeam = useTeamStore((state) =>
    state.teams.find((team) => team.id === state.selectedTeamId),
  );
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);
  const clearActive = useTradeOfferStore((state) => state.clearActive);
  const { push: pushToast } = useToast();
  const [userAssetSource, setUserAssetSource] = React.useState<TeamTradeAssetSourceDTO | null>(null);
  const [partnerAssetSource, setPartnerAssetSource] = React.useState<TeamTradeAssetSourceDTO | null>(
    null,
  );
  const [extraIncomingSelections, setExtraIncomingSelections] = React.useState<ExtraSelection[]>(
    () => Array.from({ length: ADJUSTMENT_SLOT_COUNT }, () => null),
  );
  const [extraOutgoingSelections, setExtraOutgoingSelections] = React.useState<ExtraSelection[]>(
    () => Array.from({ length: ADJUSTMENT_SLOT_COUNT }, () => null),
  );
  const [evaluatedIncomingAssets, setEvaluatedIncomingAssets] = React.useState<TradeOfferAssetDTO[]>(
    [],
  );
  const [evaluatedOutgoingAssets, setEvaluatedOutgoingAssets] = React.useState<TradeOfferAssetDTO[]>(
    [],
  );
  const [evaluatedAiInterest, setEvaluatedAiInterest] = React.useState<TradeOfferDTO['aiInterest'] | null>(
    null,
  );
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [activePickerContext, setActivePickerContext] = React.useState<ActivePickerContext | null>(
    null,
  );
  const [duplicateMessage, setDuplicateMessage] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [meterExplanation, setMeterExplanation] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingAssetSources, setIsLoadingAssetSources] = React.useState(false);
  const [activePlayerDetails, setActivePlayerDetails] = React.useState<PlayerDetailsSource | null>(
    null,
  );
  const evaluateRequestRef = React.useRef(0);

  const openPlayerDetailsFromAsset = React.useCallback(
    (asset: Extract<TradeOfferAssetDTO, { type: 'player' }>) => {
      const userMatch = userAssetSource?.players.find((player) => player.id === asset.playerId);
      const partnerMatch = partnerAssetSource?.players.find((player) => player.id === asset.playerId);
      const matchedPlayer = userMatch ?? partnerMatch;

      if (matchedPlayer) {
        setActivePlayerDetails({
          kind: matchedPlayer.teamAbbr === teamAbbr ? 'roster' : 'tradeAsset',
          player: matchedPlayer,
        });
        return;
      }

      const nameParts = asset.name.split(' ');
      const firstName = nameParts[0] ?? asset.name;
      const lastName = nameParts.slice(1).join(' ') || asset.name;
      setActivePlayerDetails({
        kind: asset.teamAbbr === teamAbbr ? 'roster' : 'tradeAsset',
        player: {
          id: asset.playerId,
          firstName,
          lastName,
          teamAbbr: asset.teamAbbr,
          position: asset.position,
          age: asset.age ?? undefined,
          rating: asset.rating ?? undefined,
          capHit: asset.capHit,
          contractYearsRemaining: 0,
          status: 'active',
          headshotUrl: asset.headshotUrl ?? null,
        },
      });
    },
    [partnerAssetSource, teamAbbr, userAssetSource],
  );

  const loadAssetSources = React.useCallback(async () => {
    if (!offer || !saveId) return false;

    setIsLoadingAssetSources(true);
    const actionableSaveId = await ensureRecoverableSaveId(
      {
        preferredSaveId: saveId,
        teamId,
        teamAbbr,
        capSpace,
        capLimit,
        roster,
        phase,
        unlocked,
      },
      setSaveHeader,
    );

    if (!actionableSaveId) {
      setIsLoadingAssetSources(false);
      setActionMessage('Unable to load trade assets right now.');
      return false;
    }

    const response = await apiFetch(
      '/api/trade-offers/assets',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId: actionableSaveId,
          partnerTeamAbbr: offer.proposingTeamAbbr,
        }),
      },
      { skipSaveGuard: true },
    );

    if (!response.ok) {
      setIsLoadingAssetSources(false);
      setActionMessage('Unable to load trade assets right now.');
      return false;
    }

    const data = (await response.json()) as TradeOfferAssetsResponse;
    if (!data.ok) {
      setIsLoadingAssetSources(false);
      setActionMessage(data.error ?? 'Unable to load trade assets right now.');
      return false;
    }

    setUserAssetSource(data.user);
    setPartnerAssetSource(data.partner);
    setIsLoadingAssetSources(false);
    return true;
  }, [
    capLimit,
    capSpace,
    offer,
    phase,
    roster,
    saveId,
    setSaveHeader,
    teamAbbr,
    teamId,
    unlocked,
  ]);

  const openAssetPicker = React.useCallback(
    async (side: ExtraSide, slotIndex: number) => {
      setDuplicateMessage(null);
      setActionMessage(null);
      const loaded = await loadAssetSources();
      if (!loaded) {
        return;
      }
      setActivePickerContext({ side, slotIndex });
      setIsPickerOpen(true);
    },
    [loadAssetSources],
  );

  React.useEffect(() => {
    if (!open || !offer) {
      setUserAssetSource(null);
      setPartnerAssetSource(null);
      setExtraIncomingSelections(Array.from({ length: ADJUSTMENT_SLOT_COUNT }, () => null));
      setExtraOutgoingSelections(Array.from({ length: ADJUSTMENT_SLOT_COUNT }, () => null));
      setEvaluatedIncomingAssets([]);
      setEvaluatedOutgoingAssets([]);
      setEvaluatedAiInterest(null);
      setDuplicateMessage(null);
      setActionMessage(null);
      setMeterExplanation(null);
      setActivePickerContext(null);
      setIsSubmitting(false);
    }
  }, [offer, open]);

  React.useEffect(() => {
    if (!open || !offer || !saveId) return;

    let cancelled = false;
    const loadPartnerAssets = async () => {
      const loaded = await loadAssetSources();
      if (!loaded || cancelled) return;
    };

    void loadPartnerAssets();
    return () => {
      cancelled = true;
    };
  }, [
    loadAssetSources,
    offer,
    open,
    saveId,
  ]);

  React.useEffect(() => {
    if (!open || !offer || !saveId) return;

    const extraIncomingPlayerIds = extraIncomingSelections
      .filter((selection): selection is Extract<ExtraSelection, { type: 'player' }> =>
        Boolean(selection && selection.type === 'player'),
      )
      .map((selection) => selection.id);
    const extraIncomingPickIds = extraIncomingSelections
      .filter((selection): selection is Extract<ExtraSelection, { type: 'pick' }> =>
        Boolean(selection && selection.type === 'pick'),
      )
      .map((selection) => selection.id);
    const extraOutgoingPlayerIds = extraOutgoingSelections
      .filter((selection): selection is Extract<ExtraSelection, { type: 'player' }> =>
        Boolean(selection && selection.type === 'player'),
      )
      .map((selection) => selection.id);
    const extraOutgoingPickIds = extraOutgoingSelections
      .filter((selection): selection is Extract<ExtraSelection, { type: 'pick' }> =>
        Boolean(selection && selection.type === 'pick'),
      )
      .map((selection) => selection.id);

    let cancelled = false;
    const requestId = evaluateRequestRef.current + 1;
    evaluateRequestRef.current = requestId;
    const evaluate = async () => {
      const actionableSaveId = await ensureRecoverableSaveId(
        {
          preferredSaveId: saveId,
          teamId,
          teamAbbr,
          capSpace,
          capLimit,
          roster,
          phase,
          unlocked,
        },
        setSaveHeader,
      );

      if (!actionableSaveId || cancelled) {
        return;
      }

      const response = await apiFetch('/api/trade-offers/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId: actionableSaveId,
          offer,
          extraIncomingPlayerIds,
          extraIncomingPickIds,
          extraOutgoingPlayerIds,
          extraOutgoingPickIds,
        }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as TradeOfferEvaluateResponse;
      if (!data.ok || cancelled || evaluateRequestRef.current !== requestId) return;
      setEvaluatedIncomingAssets(data.extraIncomingAssets);
      setEvaluatedOutgoingAssets(data.extraOutgoingAssets);
      setEvaluatedAiInterest(data.aiInterest);
      setMeterExplanation(data.aiExplanation ?? data.aiInterest.explanation ?? offer.reason);
    };

    void evaluate();
    return () => {
      cancelled = true;
    };
  }, [
    capLimit,
    capSpace,
    extraIncomingSelections,
    extraOutgoingSelections,
    offer,
    open,
    phase,
    roster,
    saveId,
    setSaveHeader,
    teamAbbr,
    teamId,
    unlocked,
  ]);

  if (!open || !offer) return null;

  const currentAiInterest = evaluatedAiInterest ?? offer.aiInterest;
  const clampedScore = Math.max(0, Math.min(MAX_METER_SCORE, currentAiInterest.score));
  const meterWidth = (clampedScore / MAX_METER_SCORE) * 100;
  const currentExplanation =
    meterExplanation ??
    currentAiInterest.explanation ??
    'They called about this framework and still see a realistic path to a deal.';

  const selectedIncomingIds = new Set(extraIncomingSelections.filter(Boolean).map((selection) => selection!.id));
  const selectedOutgoingIds = new Set(extraOutgoingSelections.filter(Boolean).map((selection) => selection!.id));
  const existingIncomingPlayerIds = new Set(
    offer.incoming.assets
      .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'player' }> => asset.type === 'player')
      .map((asset) => asset.playerId),
  );
  const existingOutgoingPlayerIds = new Set(
    offer.outgoing.assets
      .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'player' }> => asset.type === 'player')
      .map((asset) => asset.playerId),
  );
  const existingIncomingPickIds = new Set(
    offer.incoming.assets
      .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'pick' }> => asset.type === 'pick')
      .map((asset) => asset.id),
  );
  const existingOutgoingPickIds = new Set(
    offer.outgoing.assets
      .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'pick' }> => asset.type === 'pick')
      .map((asset) => asset.id),
  );

  const userPlayers = userAssetSource?.players ?? roster;
  const userDraftPicks = userAssetSource?.draftPicks ?? [];
  const partnerPlayers = partnerAssetSource?.players ?? [];
  const partnerDraftPicks = partnerAssetSource?.draftPicks ?? [];

  const availablePlayers =
    activePickerContext?.side === 'incoming'
      ? partnerPlayers.filter(
          (player) => !existingIncomingPlayerIds.has(player.id) && !selectedIncomingIds.has(player.id),
        )
      : userPlayers.filter(
          (player) => !existingOutgoingPlayerIds.has(player.id) && !selectedOutgoingIds.has(player.id),
        );

  const availablePicks = activePickerContext
    ? (
        activePickerContext.side === 'incoming' ? partnerDraftPicks : userDraftPicks
      ).filter((pick) =>
        activePickerContext.side === 'incoming'
          ? !existingIncomingPickIds.has(pick.id) && !selectedIncomingIds.has(pick.id)
          : !existingOutgoingPickIds.has(pick.id) && !selectedOutgoingIds.has(pick.id),
      )
    : [];

  const incomingSlotAssets = buildSlotAssets({
    selections: extraIncomingSelections,
    evaluatedAssets: evaluatedIncomingAssets,
    roster: partnerPlayers,
    draftPicks: partnerDraftPicks,
  });
  const outgoingSlotAssets = buildSlotAssets({
    selections: extraOutgoingSelections,
    evaluatedAssets: evaluatedOutgoingAssets,
    roster: userPlayers,
    draftPicks: userDraftPicks,
  });

  const updateSelectionsForSide = (
    side: ExtraSide,
    updater: (current: ExtraSelection[]) => ExtraSelection[],
  ) => {
    if (side === 'incoming') {
      setExtraIncomingSelections((current) => updater(current));
      return;
    }
    setExtraOutgoingSelections((current) => updater(current));
  };

  const handleAcceptTrade = async () => {
    if (!offer) return;
    setActionMessage(null);
    setIsSubmitting(true);

    const actionableSaveId = await ensureRecoverableSaveId(
      {
        preferredSaveId: saveId,
        teamId,
        teamAbbr,
        capSpace,
        capLimit,
        roster,
        phase,
        unlocked,
      },
      setSaveHeader,
    );

    if (!actionableSaveId) {
      setActionMessage('Unable to recover your offseason session.');
      setIsSubmitting(false);
      return;
    }

    const extraIncomingPlayerIds = extraIncomingSelections
      .filter((selection): selection is Extract<ExtraSelection, { type: 'player' }> =>
        Boolean(selection && selection.type === 'player'),
      )
      .map((selection) => selection.id);
    const extraIncomingPickIds = extraIncomingSelections
      .filter((selection): selection is Extract<ExtraSelection, { type: 'pick' }> =>
        Boolean(selection && selection.type === 'pick'),
      )
      .map((selection) => selection.id);
    const extraOutgoingPlayerIds = extraOutgoingSelections
      .filter((selection): selection is Extract<ExtraSelection, { type: 'player' }> =>
        Boolean(selection && selection.type === 'player'),
      )
      .map((selection) => selection.id);
    const extraOutgoingPickIds = extraOutgoingSelections
      .filter((selection): selection is Extract<ExtraSelection, { type: 'pick' }> =>
        Boolean(selection && selection.type === 'pick'),
      )
      .map((selection) => selection.id);

    const response = await apiFetch('/api/trade-offers/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId: actionableSaveId,
        offer,
        extraIncomingPlayerIds,
        extraIncomingPickIds,
        extraOutgoingPlayerIds,
        extraOutgoingPickIds,
      }),
    });

    if (!response.ok) {
      setActionMessage('Unable to complete this trade right now.');
      setIsSubmitting(false);
      return;
    }

    const data = (await response.json()) as AcceptTradeOfferResponse;
    if (!data.ok) {
      setActionMessage(data.error ?? 'Unable to complete this trade right now.');
      setIsSubmitting(false);
      return;
    }

    setEvaluatedAiInterest(data.aiInterest);

    if (!data.accepted) {
      setActionMessage(data.error);
      setIsSubmitting(false);
      return;
    }

    setSaveHeader(
      {
        ok: true,
        saveId: actionableSaveId,
        teamAbbr: data.header.teamAbbr,
        capSpace: data.header.capSpace,
        capLimit: data.header.capLimit,
        rosterCount: data.header.rosterCount,
        rosterLimit: data.header.rosterLimit,
        phase: data.header.phase,
        unlocked: data.header.unlocked,
        createdAt: data.header.createdAt,
      },
      teamId,
    );
    setRoster(data.roster);
    dispatchSaveDataUpdated({
      saveId: actionableSaveId,
      teamAbbr: data.header.teamAbbr,
      reason: 'trade-offer-accepted',
    });
    const previousRoster = roster;

    const acquiredPlayerIds = new Set(
      [
        ...offer.incoming.assets,
        ...evaluatedIncomingAssets,
      ]
        .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'player' }> => asset.type === 'player')
        .map((asset) => asset.playerId),
    );
    const acquiredPlayer = data.roster
      .filter((player) => acquiredPlayerIds.has(player.id))
      .sort((left, right) => (resolvePlayerRating(right) ?? -1) - (resolvePlayerRating(left) ?? -1))[0];

    if (acquiredPlayer) {
      const reactionToast = buildStarReactionToastPayload({
        incomingPlayer: acquiredPlayer,
        roster: data.roster,
        actionType: 'trade',
        teamAbbr,
        teamName: selectedTeam?.name,
      });
      if (reactionToast) {
        pushToast({
          id: `star-reaction:trade-offer:${actionableSaveId}:${offer.id}:${acquiredPlayer.id}`,
          kind: 'starReaction',
          durationMs: 5200,
          starReaction: reactionToast,
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
          id: `chain-reaction:trade-offer:${actionableSaveId}:${offer.id}:${acquiredPlayer.id}`,
          kind: 'chainReaction',
          durationMs: 5600,
          chainReaction: {
            title: 'Ripple Effects',
            subtitle: 'What this trade changes',
            effects: chainReaction.effects.map((effect) => effect.message),
          },
        });
      }
    }

    const tradeProgress = recordProgressEvent({
      saveId: actionableSaveId,
      step: 'manage',
      eventKey: `trade-offer-accepted:${offer.id}`,
      points: OFFSEASON_PROGRESS_POINTS.manage.trade,
    });
    if (tradeProgress.changed) {
      pushToast({
        id: `progress:${actionableSaveId}:trade-offer-accepted:${offer.id}`,
        kind: 'progress',
        durationMs: 3400,
        progress: {
          message: 'Completed a trade proposal and improved your roster flexibility.',
          detail: 'Manage Team',
        },
      });
    }
    if (capSpace < 0 && data.header.capSpace >= 0) {
      const capProgress = recordProgressEvent({
        saveId: actionableSaveId,
        step: 'manage',
        eventKey: `cap-resolved:trade-offer:${offer.id}`,
        points: OFFSEASON_PROGRESS_POINTS.manage.cap_resolved,
      });
      if (capProgress.changed) {
        pushToast({
          id: `progress:${actionableSaveId}:cap-resolved:trade-offer:${offer.id}`,
          kind: 'progress',
          durationMs: 3400,
          progress: {
            message: 'Solved your cap issue through the trade market.',
            detail: 'Manage Team',
          },
        });
      }
    }

    clearActive();
    onClose();
    setIsSubmitting(false);
  };

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
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                  <div
                    className={cn('h-2 rounded-full transition-all', interestBarClass(currentAiInterest.score))}
                    style={{ width: `${meterWidth}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{currentExplanation}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-white">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Your Offer
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {offer.outgoing.teamName}
                  </p>
                </div>
                <div className="space-y-3 px-4 py-4">
                  {offer.outgoing.assets.map((asset) =>
                    renderAssetCard(asset, openPlayerDetailsFromAsset),
                  )}
                  <TradeAssetSlots
                    slots={outgoingSlotAssets}
                    onAdd={(slotIndex) => {
                      void openAssetPicker('outgoing', slotIndex);
                    }}
                    onReplace={(slotIndex) => {
                      void openAssetPicker('outgoing', slotIndex);
                    }}
                    onRemove={(slotIndex) => {
                      setActionMessage(null);
                      setExtraOutgoingSelections((current) =>
                        current.map((selection, index) => (index === slotIndex ? null : selection)),
                      );
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    CPU Offer
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {offer.incoming.teamName}
                  </p>
                </div>
                <div className="space-y-3 px-4 py-4">
                  {offer.incoming.assets.map((asset) =>
                    renderAssetCard(asset, openPlayerDetailsFromAsset),
                  )}
                  <TradeAssetSlots
                    slots={incomingSlotAssets}
                    onAdd={(slotIndex) => {
                      void openAssetPicker('incoming', slotIndex);
                    }}
                    onReplace={(slotIndex) => {
                      void openAssetPicker('incoming', slotIndex);
                    }}
                    onRemove={(slotIndex) => {
                      setActionMessage(null);
                      setExtraIncomingSelections((current) =>
                        current.map((selection, index) => (index === slotIndex ? null : selection)),
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border px-4 py-4 sm:px-6">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-[20px] text-sm text-muted-foreground">
                {actionMessage ? <span>{actionMessage}</span> : null}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" onClick={handleAcceptTrade} disabled={isSubmitting}>
                  {isSubmitting ? 'Accepting...' : 'Accept Trade'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TradeAssetPickerModal
        isOpen={isPickerOpen}
        title={
          activePickerContext?.side === 'incoming'
            ? `Add ${offer.proposingTeamName} asset`
            : 'Add your asset'
        }
        players={availablePlayers}
        picks={availablePicks}
        duplicateMessage={duplicateMessage}
        loadingMessage={isLoadingAssetSources ? 'Loading assets...' : null}
        onClose={() => {
          setIsPickerOpen(false);
          setActivePickerContext(null);
        }}
        onSelectPlayer={(player) => {
          if (!activePickerContext) return;
          const duplicateIds =
            activePickerContext.side === 'incoming' ? selectedIncomingIds : selectedOutgoingIds;
          if (duplicateIds.has(player.id)) {
            setDuplicateMessage('That asset is already in this package.');
            return;
          }
          setDuplicateMessage(null);
          setActionMessage(null);
          updateSelectionsForSide(activePickerContext.side, (current) =>
            current.map((selection, index) =>
              index === activePickerContext.slotIndex ? { type: 'player', id: player.id } : selection,
            ),
          );
        }}
        onSelectPick={(pickId) => {
          if (!activePickerContext) return;
          const duplicateIds =
            activePickerContext.side === 'incoming' ? selectedIncomingIds : selectedOutgoingIds;
          if (duplicateIds.has(pickId)) {
            setDuplicateMessage('That asset is already in this package.');
            return;
          }
          setDuplicateMessage(null);
          setActionMessage(null);
          updateSelectionsForSide(activePickerContext.side, (current) =>
            current.map((selection, index) =>
              index === activePickerContext.slotIndex ? { type: 'pick', id: pickId } : selection,
            ),
          );
        }}
      />
      <PlayerDetailsModal
        isOpen={Boolean(activePlayerDetails)}
        source={activePlayerDetails}
        roster={roster}
        teams={teams}
        userTeamAbbr={teamAbbr}
        capSpace={capSpace}
        capLimit={capLimit}
        onClose={() => setActivePlayerDetails(null)}
      />
    </>
  );
}
