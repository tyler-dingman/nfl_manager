'use client';

import * as React from 'react';

import PlayerDetailsModal from '@/components/player-details-modal';
import PlayerTypeIcon from '@/components/player-type-icon';
import TradeAssetPickerModal from '@/components/trade-asset-picker-modal';
import TradeAssetSlots, { type TradeSlotAsset } from '@/components/trade-asset-slots';
import { Button } from '@/components/ui/button';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { useSaveStore } from '@/features/save/save-store';
import { useToast } from '@/components/ui/toast';
import { OFFSEASON_PROGRESS_POINTS } from '@/lib/offseason-progress';
import { apiFetch } from '@/lib/api';
import { generateChainReactionEffects } from '@/lib/chain-reaction-effects';
import { getPlayerTypeIndicator } from '@/lib/player-type-indicator';
import { buildStarReactionToastPayload } from '@/lib/star-player-reaction';
import { cn } from '@/lib/utils';
import type { PlayerDetailsSource } from '@/lib/player-details';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveUnlocksDTO } from '@/types/save';
import type { TeamDTO } from '@/types/team';
import type {
  TeamTradeAssetSourceDTO,
  TradeOfferAssetDTO,
  TradeOfferDTO,
  TradePickAssetDTO,
} from '@/types/trade-offers';

type DraftTradeOfferReviewModalProps = {
  offer: TradeOfferDTO | null;
  open: boolean;
  saveId: string;
  draftSessionId: string;
  sessionSnapshot: DraftSessionDTO;
  saveSnapshot: {
    teamAbbr: string;
    capSpace: number;
    capLimit: number;
    roster: PlayerRowDTO[];
    phase?: string;
    unlocked?: SaveUnlocksDTO;
    createdAt?: string;
  };
  teams: TeamDTO[];
  onClose: () => void;
  onAccepted: (payload: {
    session: DraftSessionDTO;
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

type ExtraSelection = { type: 'player'; id: string } | { type: 'pick'; id: string } | null;

type TradeSide = 'incoming' | 'outgoing';

type ActivePickerContext = {
  side: TradeSide;
  slotIndex: number;
};

type DraftTradeOfferAssetsResponse =
  | {
      ok: true;
      user: TeamTradeAssetSourceDTO;
      partner: TeamTradeAssetSourceDTO;
    }
  | { ok: false; error: string };

type DraftTradeOfferEvaluateResponse =
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

type DraftTradeOfferAcceptResponse =
  | {
      ok: true;
      accepted: true;
      session: DraftSessionDTO;
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
      aiInterest: TradeOfferDTO['aiInterest'];
    }
  | { ok: true; accepted: false; aiInterest: TradeOfferDTO['aiInterest']; error: string }
  | { ok: false; error: string };

const MAX_METER_SCORE = 1.2;
const ADJUSTMENT_SLOT_COUNT = 5;
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
  meta: asset.type === 'pick' ? `${Math.round(asset.projectedValuePoints)} pts` : asset.contractSummary,
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
  meta: player.contract
    ? `${player.contract.yearsRemaining} yr · $${player.contract.apy.toFixed(1)}M`
    : player.capHit,
  headshotUrl: player.headshotUrl ?? null,
  playerTypeIndicator: getPlayerTypeIndicator(player),
});

const buildFallbackPickSlotAsset = (pick: TradePickAssetDTO): TradeSlotAsset => ({
  id: pick.id,
  type: 'pick',
  label: pick.label,
  sublabel: `${pick.year} R${pick.round}${pick.overallSlot ? ` · Pick ${pick.overallSlot}` : ''}`,
  meta: `${Math.round(pick.projectedValuePoints)} pts`,
});

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
      if (evaluatedAsset) return toSlotAsset(evaluatedAsset);
      const player = roster.find((entry) => entry.id === selection.id);
      return player ? buildFallbackPlayerSlotAsset(player) : null;
    }

    const evaluatedAsset = evaluatedAssets.find(
      (asset): asset is Extract<TradeOfferAssetDTO, { type: 'pick' }> =>
        asset.type === 'pick' && asset.id === selection.id,
    );
    if (evaluatedAsset) return toSlotAsset(evaluatedAsset);
    const pick = draftPicks.find((entry) => entry.id === selection.id);
    return pick ? buildFallbackPickSlotAsset(pick) : null;
  });

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
        <img src={NFL_DRAFT_LOGO_URL} alt="NFL Draft" className="h-10 w-10 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{asset.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{renderAssetMeta(asset)}</p>
        </div>
      </div>
    )}
  </div>
);

const buildManualDraftOffer = ({
  partnerTeam,
  userTeam,
}: {
  partnerTeam: TeamDTO;
  userTeam: TeamDTO | null;
}): TradeOfferDTO => ({
  id: `draft-offer-builder:${partnerTeam.abbr}`,
  phase: 'draft',
  archetype: 'move_down',
  trigger: 'manual-offer',
  generatedAt: new Date().toISOString(),
  chartModel: 'drafttek-classic',
  proposingTeamAbbr: partnerTeam.abbr,
  proposingTeamName: partnerTeam.name,
  proposingTeamLogoUrl: partnerTeam.logoUrl,
  headline: `Offer ${partnerTeam.name} a trade`,
  summary: 'Build a package from either side and test their interest live.',
  reason: 'Use players, picks, or both to shape the deal.',
  incoming: {
    teamAbbr: partnerTeam.abbr,
    teamName: partnerTeam.name,
    totalValue: 0,
    assets: [],
  },
  outgoing: {
    teamAbbr: userTeam?.abbr ?? 'USER',
    teamName: userTeam?.name ?? 'Your Team',
    totalValue: 0,
    assets: [],
  },
  userInterest: {
    label: 'Build a Package',
    band: 'low_interest',
    score: 0,
    explanation: 'Add assets to see how the framework looks for both teams.',
  },
  aiInterest: {
    label: 'Build a Package',
    band: 'low_interest',
    score: 0,
    explanation: 'Add assets to see how the framework looks for both teams.',
  },
  debug: {
    seed: `draft-offer-builder:${partnerTeam.abbr}`,
    candidateScore: 0,
    userScore: 0,
    aiScore: 0,
    reasons: ['manual trade builder'],
  },
});

export function DraftTradeOfferReviewModal({
  offer,
  open,
  saveId,
  draftSessionId,
  sessionSnapshot,
  saveSnapshot,
  teams,
  onClose,
  onAccepted,
}: DraftTradeOfferReviewModalProps) {
  const roster = useSaveStore((state) => state.roster);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);
  const { push: pushToast } = useToast();
  const userTeam = React.useMemo(
    () => teams.find((team) => team.abbr === sessionSnapshot.userTeamAbbr) ?? null,
    [sessionSnapshot.userTeamAbbr, teams],
  );

  const isManualOffer = Boolean(offer && offer.trigger === 'manual-offer');
  const [partnerTeamAbbr, setPartnerTeamAbbr] = React.useState<string>(offer?.proposingTeamAbbr ?? '');
  const partnerTeam = React.useMemo(
    () => teams.find((team) => team.abbr === partnerTeamAbbr) ?? null,
    [partnerTeamAbbr, teams],
  );
  const effectiveOffer = React.useMemo(() => {
    if (!offer) return null;
    if (!isManualOffer || !partnerTeam) return offer;
    return buildManualDraftOffer({ partnerTeam, userTeam });
  }, [isManualOffer, offer, partnerTeam, userTeam]);

  const [userAssetSource, setUserAssetSource] = React.useState<TeamTradeAssetSourceDTO | null>(null);
  const [partnerAssetSource, setPartnerAssetSource] = React.useState<TeamTradeAssetSourceDTO | null>(null);
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
  const [meterExplanation, setMeterExplanation] = React.useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [activePickerContext, setActivePickerContext] = React.useState<ActivePickerContext | null>(
    null,
  );
  const [duplicateMessage, setDuplicateMessage] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingAssetSources, setIsLoadingAssetSources] = React.useState(false);
  const [activePlayerDetails, setActivePlayerDetails] = React.useState<PlayerDetailsSource | null>(
    null,
  );
  const evaluateRequestRef = React.useRef(0);

  React.useEffect(() => {
    if (offer?.proposingTeamAbbr) {
      setPartnerTeamAbbr(offer.proposingTeamAbbr);
    }
  }, [offer?.proposingTeamAbbr]);

  React.useEffect(() => {
    if (!open || !effectiveOffer) {
      setUserAssetSource(null);
      setPartnerAssetSource(null);
      setExtraIncomingSelections(Array.from({ length: ADJUSTMENT_SLOT_COUNT }, () => null));
      setExtraOutgoingSelections(Array.from({ length: ADJUSTMENT_SLOT_COUNT }, () => null));
      setEvaluatedIncomingAssets([]);
      setEvaluatedOutgoingAssets([]);
      setEvaluatedAiInterest(null);
      setMeterExplanation(null);
      setDuplicateMessage(null);
      setActionMessage(null);
      setActivePickerContext(null);
      setIsSubmitting(false);
      return;
    }

    setExtraIncomingSelections(Array.from({ length: ADJUSTMENT_SLOT_COUNT }, () => null));
    setExtraOutgoingSelections(Array.from({ length: ADJUSTMENT_SLOT_COUNT }, () => null));
    setEvaluatedIncomingAssets([]);
    setEvaluatedOutgoingAssets([]);
    setEvaluatedAiInterest(null);
    setMeterExplanation(null);
    setDuplicateMessage(null);
    setActionMessage(null);
    setActivePickerContext(null);
    setIsSubmitting(false);
  }, [effectiveOffer?.id, open]);

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
      setActivePlayerDetails({
        kind: asset.teamAbbr === teamAbbr ? 'roster' : 'tradeAsset',
        player: {
          id: asset.playerId,
          firstName: nameParts[0] ?? asset.name,
          lastName: nameParts.slice(1).join(' ') || asset.name,
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
    if (!effectiveOffer) return false;

    setIsLoadingAssetSources(true);
    const response = await apiFetch('/api/draft/trade-offers/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId,
        draftSessionId,
        partnerTeamAbbr: effectiveOffer.proposingTeamAbbr,
        sessionSnapshot,
        saveSnapshot,
      }),
    });

    if (!response.ok) {
      setIsLoadingAssetSources(false);
      setActionMessage('Unable to load draft trade assets right now.');
      return false;
    }

    const data = (await response.json()) as DraftTradeOfferAssetsResponse;
    if (!data.ok) {
      setIsLoadingAssetSources(false);
      setActionMessage(data.error ?? 'Unable to load draft trade assets right now.');
      return false;
    }

    setUserAssetSource(data.user);
    setPartnerAssetSource(data.partner);
    setIsLoadingAssetSources(false);
    return true;
  }, [draftSessionId, effectiveOffer, saveId, saveSnapshot, sessionSnapshot]);

  React.useEffect(() => {
    if (!open || !effectiveOffer) return;
    let cancelled = false;

    const load = async () => {
      const loaded = await loadAssetSources();
      if (!loaded || cancelled) return;
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [effectiveOffer, loadAssetSources, open]);

  React.useEffect(() => {
    if (!open || !effectiveOffer) return;

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

    const requestId = evaluateRequestRef.current + 1;
    evaluateRequestRef.current = requestId;
    let cancelled = false;

    const evaluate = async () => {
      const response = await apiFetch('/api/draft/trade-offers/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId,
          draftSessionId,
          offer: effectiveOffer,
          extraIncomingPlayerIds,
          extraIncomingPickIds,
          extraOutgoingPlayerIds,
          extraOutgoingPickIds,
          sessionSnapshot,
          saveSnapshot,
        }),
      });

      if (!response.ok) return;
      const data = (await response.json()) as DraftTradeOfferEvaluateResponse;
      if (!data.ok || cancelled || evaluateRequestRef.current !== requestId) return;
      setEvaluatedIncomingAssets(data.extraIncomingAssets);
      setEvaluatedOutgoingAssets(data.extraOutgoingAssets);
      setEvaluatedAiInterest(data.aiInterest);
      setMeterExplanation(data.aiExplanation ?? data.aiInterest.explanation ?? effectiveOffer.reason);
    };

    void evaluate();
    return () => {
      cancelled = true;
    };
  }, [
    draftSessionId,
    effectiveOffer,
    extraIncomingSelections,
    extraOutgoingSelections,
    open,
    saveId,
    saveSnapshot,
    sessionSnapshot,
  ]);

  const openAssetPicker = React.useCallback(
    async (side: TradeSide, slotIndex: number) => {
      setDuplicateMessage(null);
      setActionMessage(null);
      const loaded = await loadAssetSources();
      if (!loaded) return;
      setActivePickerContext({ side, slotIndex });
      setIsPickerOpen(true);
    },
    [loadAssetSources],
  );

  if (!open || !effectiveOffer) {
    return null;
  }

  const currentAiInterest = evaluatedAiInterest ?? effectiveOffer.aiInterest;
  const selectedIncomingIds = new Set(extraIncomingSelections.filter(Boolean).map((selection) => selection!.id));
  const selectedOutgoingIds = new Set(extraOutgoingSelections.filter(Boolean).map((selection) => selection!.id));
  const existingIncomingPlayerIds = new Set(
    effectiveOffer.incoming.assets
      .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'player' }> => asset.type === 'player')
      .map((asset) => asset.playerId),
  );
  const existingOutgoingPlayerIds = new Set(
    effectiveOffer.outgoing.assets
      .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'player' }> => asset.type === 'player')
      .map((asset) => asset.playerId),
  );
  const existingIncomingPickIds = new Set(
    effectiveOffer.incoming.assets
      .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'pick' }> => asset.type === 'pick')
      .map((asset) => asset.id),
  );
  const existingOutgoingPickIds = new Set(
    effectiveOffer.outgoing.assets
      .filter((asset): asset is Extract<TradeOfferAssetDTO, { type: 'pick' }> => asset.type === 'pick')
      .map((asset) => asset.id),
  );

  const userPlayers = userAssetSource?.players ?? saveSnapshot.roster;
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

  const clampedScore = Math.max(0, Math.min(MAX_METER_SCORE, currentAiInterest.score));
  const meterWidth = (clampedScore / MAX_METER_SCORE) * 100;
  const totalAssetCount =
    effectiveOffer.incoming.assets.length +
    effectiveOffer.outgoing.assets.length +
    evaluatedIncomingAssets.length +
    evaluatedOutgoingAssets.length;
  const currentExplanation =
    totalAssetCount === 0
      ? 'Start with an empty framework, then add players or picks to see live interest.'
      : meterExplanation ??
        currentAiInterest.explanation ??
        'This package is close enough to evaluate live as you adjust it.';

  const updateSelectionsForSide = (
    side: TradeSide,
    updater: (current: ExtraSelection[]) => ExtraSelection[],
  ) => {
    if (side === 'incoming') {
      setExtraIncomingSelections((current) => updater(current));
      return;
    }
    setExtraOutgoingSelections((current) => updater(current));
  };

  const handleSubmitTrade = async () => {
    setActionMessage(null);
    setIsSubmitting(true);

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

    const response = await apiFetch('/api/draft/trade-offers/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId,
        draftSessionId,
        offer: effectiveOffer,
        extraIncomingPlayerIds,
        extraIncomingPickIds,
        extraOutgoingPlayerIds,
        extraOutgoingPickIds,
        sessionSnapshot,
        saveSnapshot,
      }),
    });

    const data = (await response.json()) as DraftTradeOfferAcceptResponse;
    if (!response.ok || !data.ok) {
      setActionMessage(data.ok ? 'Unable to complete this trade right now.' : data.error);
      setIsSubmitting(false);
      return;
    }

    setEvaluatedAiInterest(data.aiInterest);

    if (!data.accepted) {
      setActionMessage(data.error);
      setIsSubmitting(false);
      return;
    }

    const acquiredPlayerIds = new Set(
      [...effectiveOffer.incoming.assets, ...evaluatedIncomingAssets]
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
        teamName: userTeam?.name,
      });
      if (starToast) {
        pushToast({
          id: `star-reaction:draft-trade:${saveId}:${effectiveOffer.id}:${acquiredPlayer.id}`,
          kind: 'starReaction',
          durationMs: 5200,
          starReaction: starToast,
        });
      }

      const chainReaction = generateChainReactionEffects({
        beforeRoster: roster,
        afterRoster: data.roster,
        beforeCapSpace: capSpace,
        afterCapSpace: data.header.capSpace,
        moveType: 'trade',
        player: acquiredPlayer,
      });
      if (chainReaction) {
        pushToast({
          id: `chain-reaction:draft-trade:${saveId}:${effectiveOffer.id}:${acquiredPlayer.id}`,
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
      eventKey: `draft-trade-accepted:${effectiveOffer.id}`,
      points: OFFSEASON_PROGRESS_POINTS.draft.trade_response,
    });
    if (progressResult.changed) {
      pushToast({
        id: `progress:${saveId}:draft-trade-accepted:${effectiveOffer.id}`,
        kind: 'progress',
        durationMs: 3400,
        progress: {
          message: 'Completed a live draft trade and stayed flexible on the clock.',
          detail: 'Draft',
        },
      });
    }

    onAccepted({
      session: data.session,
      roster: data.roster,
      header: data.header,
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
        <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Offer Trade
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{effectiveOffer.headline}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{effectiveOffer.summary}</p>
            </div>
            <div className="flex items-center gap-2">
              {isManualOffer ? (
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={partnerTeamAbbr}
                  onChange={(event) => setPartnerTeamAbbr(event.target.value)}
                >
                  {teams
                    .filter((team) => team.abbr !== sessionSnapshot.userTeamAbbr)
                    .map((team) => (
                      <option key={team.abbr} value={team.abbr}>
                        {team.name}
                      </option>
                    ))}
                </select>
              ) : null}
              <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto px-4 py-4 sm:px-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Your Offer
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {effectiveOffer.outgoing.teamName}
                  </p>
                </div>
                {effectiveOffer.outgoing.assets.length > 0 ? (
                  <div className="space-y-3">
                    {effectiveOffer.outgoing.assets.map((asset) =>
                      renderAssetCard(asset, openPlayerDetailsFromAsset),
                    )}
                  </div>
                ) : null}
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

              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={effectiveOffer.proposingTeamLogoUrl}
                      alt={effectiveOffer.proposingTeamName}
                      className="h-10 w-10 shrink-0 object-contain"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{effectiveOffer.proposingTeamName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{effectiveOffer.reason}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-white/90 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>Interest Meter</span>
                      <span className={cn('font-semibold', interestToneClass(currentAiInterest.score))}>
                        {totalAssetCount === 0 ? 'Build a Package' : currentAiInterest.label}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                      <div
                        className={cn('h-2 rounded-full transition-all', interestBarClass(currentAiInterest.score))}
                        style={{ width: `${totalAssetCount === 0 ? 0 : meterWidth}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{currentExplanation}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Actions
                  </p>
                  <div className="mt-3 space-y-2">
                    <Button
                      type="button"
                      className="w-full"
                      onClick={handleSubmitTrade}
                      disabled={isSubmitting || totalAssetCount === 0}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Trade'}
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={onClose}>
                      Close
                    </Button>
                  </div>
                  <div className="mt-3 min-h-[20px] text-sm text-muted-foreground">
                    {actionMessage ? <span>{actionMessage}</span> : null}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Their Offer
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {effectiveOffer.incoming.teamName}
                  </p>
                </div>
                {effectiveOffer.incoming.assets.length > 0 ? (
                  <div className="space-y-3">
                    {effectiveOffer.incoming.assets.map((asset) =>
                      renderAssetCard(asset, openPlayerDetailsFromAsset),
                    )}
                  </div>
                ) : null}
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
      </div>

      <TradeAssetPickerModal
        isOpen={isPickerOpen}
        title={
          activePickerContext?.side === 'incoming'
            ? `Add ${effectiveOffer.proposingTeamName} asset`
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
