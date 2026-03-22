'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

import { ArrowLeft, ChevronDown } from 'lucide-react';

import AppShell from '@/components/app-shell';
import TradeAssetPickerModal from '@/components/trade-asset-picker-modal';
import TradeAssetSlots, { type TradeSlotAsset } from '@/components/trade-asset-slots';
import { StepHeader } from '@/components/offseason/step-header';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { OFFSEASON_STEPS } from '@/features/experience/offseason-steps';
import { getRouteForStep } from '@/features/experience/experience-utils';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { useTradeOfferOrchestrator } from '@/features/trades/use-trade-offer-orchestrator';
import { generateChainReactionEffects } from '@/lib/chain-reaction-effects';
import { buildChantAlert } from '@/lib/falco-alerts';
import { apiFetch } from '@/lib/api';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';
import { dispatchSaveDataUpdated } from '@/lib/save-sync-events';
import { OFFSEASON_PROGRESS_POINTS } from '@/lib/offseason-progress';
import { buildStarReactionToastPayload } from '@/lib/star-player-reaction';
import { resolvePlayerRating } from '@/lib/team-overview';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';
import type { TeamDTO } from '@/types/team';
import type { TeamTradeAssetSourceDTO, TradePickAssetDTO } from '@/types/trade-offers';

type TradeAsset = {
  id: string;
  type: 'player' | 'pick';
  side: 'send' | 'receive';
  label: string;
  value: number;
  playerId?: string;
  pickId?: string;
};

type TradeDTO = {
  id: string;
  partnerTeamAbbr: string;
  sendAssets: TradeAsset[];
  receiveAssets: TradeAsset[];
};

type TradeCreateResponse = {
  trade: TradeDTO;
  userRoster: PlayerRowDTO[];
  partnerRoster: PlayerRowDTO[];
};

type TradeProposeResponse = {
  trade: TradeDTO;
  acceptance: number;
  accepted: boolean;
  header: SaveHeaderDTO;
  caps: {
    userTeamAbbr: string;
    userCapSpace: number;
    partnerTeamAbbr: string;
    partnerCapSpace: number;
  };
  simulation: {
    teams: {
      sending: {
        capDelta: number;
        resultingCapSpace: number;
        deadCap: number;
        savings: number;
      };
      receiving: {
        capDelta: number;
        resultingCapSpace: number;
        deadCap: number;
        savings: number;
      };
    };
    warnings: string[];
  };
  tradeBalance: {
    outgoingValue: number;
    incomingValue: number;
    difference: number;
    balanced: boolean;
    explanation: string;
  };
  proposal: {
    isValid: boolean;
    validationErrors: Array<{ message: string }>;
  };
};

type TradeInsights = Pick<TradeProposeResponse, 'simulation' | 'tradeBalance' | 'proposal'>;

const sumAssets = (assets: TradeAsset[]) => assets.reduce((total, asset) => total + asset.value, 0);

const getAcceptance = (sendAssets: TradeAsset[], receiveAssets: TradeAsset[]) => {
  const sendValue = sumAssets(sendAssets);
  const receiveValue = sumAssets(receiveAssets);
  if (sendValue === 0) {
    return 0;
  }

  return Math.min(100, Math.round((receiveValue / sendValue) * 100));
};

function TradeBuilderContent() {
  const searchParams = useSearchParams();
  const selectedTeam = useTeamStore((state) =>
    state.teams.find((team) => team.id === state.selectedTeamId),
  );
  const selectedPlayerId = searchParams?.get('playerId') ?? undefined;
  const requestedPartnerTeamAbbr = searchParams?.get('partnerTeamAbbr') ?? '';

  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const roster = useSaveStore((state) => state.roster);
  const phase = useSaveStore((state) => state.phase);
  const franchiseYear = useSaveStore((state) => state.franchiseYear);
  const unlocked = useSaveStore((state) => state.unlocked);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const setRoster = useSaveStore((state) => state.setRoster);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);
  const { push: pushToast } = useToast();
  const mode = useExperienceStore((state) => state.mode);
  const currentStep = useExperienceStore((state) => state.currentStep);
  const manageSubstepsCompleted = useExperienceStore((state) => state.manageSubstepsCompleted);
  const markManageSubstepComplete = useExperienceStore((state) => state.markManageSubstepComplete);
  const completeCurrentStep = useExperienceStore((state) => state.completeCurrentStep);
  const skipCurrentStep = useExperienceStore((state) => state.skipCurrentStep);
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);
  const router = useRouter();
  const [teams, setTeams] = useState<TeamDTO[]>([]);
  const [partnerTeamAbbr, setPartnerTeamAbbr] = useState<string>('');
  const [trade, setTrade] = useState<TradeDTO | null>(null);
  const [userRoster, setUserRoster] = useState<PlayerRowDTO[]>([]);
  const [partnerRoster, setPartnerRoster] = useState<PlayerRowDTO[]>([]);
  const [userDraftPicks, setUserDraftPicks] = useState<TradePickAssetDTO[]>([]);
  const [partnerDraftPicks, setPartnerDraftPicks] = useState<TradePickAssetDTO[]>([]);
  const [activeModalSide, setActiveModalSide] = useState<'send' | 'receive' | null>(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [slotAction, setSlotAction] = useState<{
    side: 'send' | 'receive';
    slotIndex: number;
  } | null>(null);
  const [pendingReplace, setPendingReplace] = useState<{
    side: 'send' | 'receive';
    asset: TradeAsset;
  } | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [proposalStatus, setProposalStatus] = useState<string>('');
  const [tradeInsights, setTradeInsights] = useState<TradeInsights | null>(null);
  const [assetPickerLoadingMessage, setAssetPickerLoadingMessage] = useState<string | null>(null);
  const [resolvedSaveId, setResolvedSaveId] = useState<string>(saveId);
  const [sendSlotIds, setSendSlotIds] = useState<Array<string | null>>(
    Array.from({ length: 5 }, () => null),
  );
  const [receiveSlotIds, setReceiveSlotIds] = useState<Array<string | null>>(
    Array.from({ length: 5 }, () => null),
  );
  const lastTradeKeyRef = useRef<string | null>(null);
  const initialTradeOfferRequestedRef = useRef<string | null>(null);
  const trackProgress = (
    eventKey: string,
    points: number,
    message: string,
    detail = 'Manage Team',
  ) => {
    if (!saveId) return;
    const result = recordProgressEvent({
      saveId,
      step: 'manage',
      eventKey,
      points,
    });
    if (!result.changed) return;
    pushToast({
      id: `progress:${saveId}:${eventKey}`,
      kind: 'progress',
      durationMs: 3400,
      progress: {
        message,
        detail,
      },
    });
  };

  const acceptance = useMemo(() => {
    if (!trade) {
      return 0;
    }

    return getAcceptance(trade.sendAssets, trade.receiveAssets);
  }, [trade]);

  useEffect(() => {
    if (saveId) {
      setResolvedSaveId(saveId);
    }
  }, [saveId]);

  const ensureActionableSaveId = useCallback(
    async (preferredSaveId?: string | null) => {
      const nextSaveId = await ensureRecoverableSaveId(
        {
          preferredSaveId: preferredSaveId ?? resolvedSaveId ?? saveId,
          teamId,
          teamAbbr,
          year: franchiseYear,
          capSpace,
          capLimit,
          roster,
          phase,
          unlocked,
        },
        setSaveHeader,
      );

      if (nextSaveId) {
        setResolvedSaveId(nextSaveId);
      }

      return nextSaveId || null;
    },
    [
      capLimit,
      capSpace,
      phase,
      resolvedSaveId,
      roster,
      saveId,
      setSaveHeader,
      teamAbbr,
      teamId,
      unlocked,
      franchiseYear,
    ],
  );
  const requestTradeOffer = useTradeOfferOrchestrator({
    enabled: phase === 'resign_cut',
    phase: 'manage',
    saveId,
    teamAbbr,
    ensureActionableSaveId,
  });

  useEffect(() => {
    const loadTeams = async () => {
      const response = await apiFetch('/api/teams');
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as TeamDTO[];
      setTeams(data);
    };

    loadTeams();
  }, []);

  useEffect(() => {
    if (phase !== 'resign_cut' || !saveId || !teamAbbr) return;
    const requestKey = `${saveId}:${teamAbbr}:trade-hub`;
    if (initialTradeOfferRequestedRef.current === requestKey) return;
    initialTradeOfferRequestedRef.current = requestKey;
    void requestTradeOffer({ trigger: 'visit-trade-hub' });
  }, [phase, requestTradeOffer, saveId, teamAbbr]);

  useEffect(() => {
    if (!teams.length || partnerTeamAbbr) {
      return;
    }

    const requestedPartner = teams.find(
      (team) => team.abbr === requestedPartnerTeamAbbr && team.abbr !== selectedTeam?.abbr,
    );
    const firstPartner = requestedPartner ?? teams.find((team) => team.abbr !== selectedTeam?.abbr);
    if (firstPartner) {
      setPartnerTeamAbbr(firstPartner.abbr);
    }
  }, [partnerTeamAbbr, requestedPartnerTeamAbbr, selectedTeam?.abbr, teams]);

  useEffect(() => {
    const loadTrade = async () => {
      if (!partnerTeamAbbr) {
        return;
      }

      let activeSaveId = await ensureActionableSaveId(saveId);

      if (!activeSaveId) {
        return;
      }

      const tradeKey = `${activeSaveId}:${partnerTeamAbbr}:${selectedPlayerId ?? ''}`;
      if (lastTradeKeyRef.current === tradeKey) {
        return;
      }

      let response = await apiFetch(
        '/api/trades/create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saveId: activeSaveId,
            teamAbbr,
            partnerTeamAbbr,
            playerId: selectedPlayerId,
          }),
        },
        { skipSaveGuard: true },
      );
      if (response.status === 404) {
        const recoveredSaveId = await ensureActionableSaveId(null);
        if (!recoveredSaveId) {
          return;
        }
        activeSaveId = recoveredSaveId;
        response = await apiFetch(
          '/api/trades/create',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              saveId: recoveredSaveId,
              teamAbbr,
              partnerTeamAbbr,
              playerId: selectedPlayerId,
            }),
          },
          { skipSaveGuard: true },
        );
      }
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as TradeCreateResponse;
      const selectedUserPlayer =
        selectedPlayerId && data.userRoster.some((player) => player.id === selectedPlayerId)
          ? (data.userRoster.find((player) => player.id === selectedPlayerId) ?? null)
          : null;
      const selectedPartnerPlayer =
        selectedPlayerId && data.partnerRoster.some((player) => player.id === selectedPlayerId)
          ? (data.partnerRoster.find((player) => player.id === selectedPlayerId) ?? null)
          : null;
      const selectedUserPlayerSeeded = selectedPlayerId
        ? data.trade.sendAssets.some((asset) => asset.playerId === selectedPlayerId)
        : true;
      const selectedPlayerSeeded = selectedPlayerId
        ? data.trade.receiveAssets.some((asset) => asset.playerId === selectedPlayerId)
        : true;

      if (selectedUserPlayer && !selectedUserPlayerSeeded) {
        const addAssetResponse = await apiFetch(
          `/api/trades/${data.trade.id}/add-asset`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              saveId: activeSaveId,
              side: 'send',
              type: 'player',
              playerId: selectedPlayerId,
            }),
          },
          { skipSaveGuard: true },
        );

        if (addAssetResponse.ok) {
          const updatedData = (await addAssetResponse.json()) as TradeCreateResponse;
          lastTradeKeyRef.current = tradeKey;
          setTrade(updatedData.trade);
          setUserRoster(updatedData.userRoster);
          setPartnerRoster(updatedData.partnerRoster);
          setProposalStatus('');
          setTradeInsights(null);
          return;
        }
      }

      if (selectedPartnerPlayer && !selectedPlayerSeeded) {
        const addAssetResponse = await apiFetch(
          `/api/trades/${data.trade.id}/add-asset`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              saveId: activeSaveId,
              side: 'receive',
              type: 'player',
              playerId: selectedPlayerId,
            }),
          },
          { skipSaveGuard: true },
        );

        if (addAssetResponse.ok) {
          const updatedData = (await addAssetResponse.json()) as TradeCreateResponse;
          lastTradeKeyRef.current = tradeKey;
          setTrade(updatedData.trade);
          setUserRoster(updatedData.userRoster);
          setPartnerRoster(updatedData.partnerRoster);
          setProposalStatus('');
          setTradeInsights(null);
          return;
        }
      }

      lastTradeKeyRef.current = tradeKey;
      setTrade(data.trade);
      setUserRoster(data.userRoster);
      setPartnerRoster(data.partnerRoster);
      setProposalStatus('');
      setTradeInsights(null);
    };

    loadTrade();
  }, [
    ensureActionableSaveId,
    partnerTeamAbbr,
    saveId,
    selectedPlayerId,
    setSaveHeader,
    teamAbbr,
    teamId,
  ]);

  useEffect(() => {
    setSendSlotIds(Array.from({ length: 5 }, () => null));
    setReceiveSlotIds(Array.from({ length: 5 }, () => null));
  }, [trade?.id]);

  const refreshTradeAssets = useCallback(
    async (preferredSaveId?: string | null) => {
      const actionableSaveId = await ensureActionableSaveId(preferredSaveId ?? saveId);
      if (!actionableSaveId || !partnerTeamAbbr) {
        return null;
      }

      const response = await apiFetch('/api/trade-offers/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId: actionableSaveId,
          partnerTeamAbbr,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as
        | {
            ok: true;
            user: TeamTradeAssetSourceDTO;
            partner: TeamTradeAssetSourceDTO;
          }
        | { ok: false; error: string };

      if (!data.ok) {
        return null;
      }

      setUserRoster(data.user.players);
      setPartnerRoster(data.partner.players);
      setUserDraftPicks(data.user.draftPicks);
      setPartnerDraftPicks(data.partner.draftPicks);

      return data;
    },
    [ensureActionableSaveId, partnerTeamAbbr, saveId],
  );

  useEffect(() => {
    if (!trade || !partnerTeamAbbr) {
      return;
    }
    void refreshTradeAssets();
  }, [partnerTeamAbbr, refreshTradeAssets, trade]);

  const recreateTradeForCurrentContext = useCallback(
    async (preferredSaveId?: string | null) => {
      if (!partnerTeamAbbr || !teamAbbr) {
        return null;
      }

      const actionableSaveId = await ensureActionableSaveId(preferredSaveId ?? saveId);
      if (!actionableSaveId) {
        return null;
      }

      const response = await apiFetch(
        '/api/trades/create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saveId: actionableSaveId,
            teamAbbr,
            partnerTeamAbbr,
            playerId: selectedPlayerId,
          }),
        },
        { skipSaveGuard: true },
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as TradeCreateResponse;
      setTrade(data.trade);
      setUserRoster(data.userRoster);
      setPartnerRoster(data.partnerRoster);
      setProposalStatus('');
      setTradeInsights(null);
      return { tradeId: data.trade.id, saveId: actionableSaveId };
    },
    [ensureActionableSaveId, partnerTeamAbbr, saveId, selectedPlayerId, teamAbbr],
  );

  const handleAddAsset = async (payload: {
    side: 'send' | 'receive';
    type: 'player' | 'pick';
    playerId?: string;
    pickId?: string;
  }) => {
    const actionableSaveId = await ensureActionableSaveId(saveId);
    if (!trade || !actionableSaveId) {
      return;
    }

    let activeTradeId = trade.id;
    let response = await apiFetch(`/api/trades/${activeTradeId}/add-asset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        saveId: actionableSaveId,
      }),
    });

    if (!response.ok) {
      const reboundTrade = await recreateTradeForCurrentContext(actionableSaveId);
      if (!reboundTrade) {
        return;
      }
      activeTradeId = reboundTrade.tradeId;
      response = await apiFetch(`/api/trades/${activeTradeId}/add-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          saveId: reboundTrade.saveId,
        }),
      });
    }

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as TradeDTO;
    setTrade(data);
  };

  const handleRemoveAsset = async (payload: {
    side: 'send' | 'receive';
    assetId?: string;
    playerId?: string;
    pickId?: string;
  }) => {
    const actionableSaveId = await ensureActionableSaveId(saveId);
    if (!trade || !actionableSaveId) {
      return;
    }

    let activeTradeId = trade.id;
    let response = await apiFetch(`/api/trades/${activeTradeId}/remove-asset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        saveId: actionableSaveId,
      }),
    });

    if (!response.ok) {
      const reboundTrade = await recreateTradeForCurrentContext(actionableSaveId);
      if (!reboundTrade) {
        return;
      }
      activeTradeId = reboundTrade.tradeId;
      response = await apiFetch(`/api/trades/${activeTradeId}/remove-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          saveId: reboundTrade.saveId,
        }),
      });
    }

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as TradeDTO;
    setTrade(data);
  };

  const handlePropose = async () => {
    const actionableSaveId = await ensureActionableSaveId(saveId);
    if (!trade || !actionableSaveId) {
      return;
    }

    let activeTradeId = trade.id;
    let response = await apiFetch(`/api/trades/${activeTradeId}/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId: actionableSaveId }),
    });

    if (!response.ok) {
      const reboundTrade = await recreateTradeForCurrentContext(actionableSaveId);
      if (!reboundTrade) {
        return;
      }
      activeTradeId = reboundTrade.tradeId;
      response = await apiFetch(`/api/trades/${activeTradeId}/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saveId: reboundTrade.saveId }),
      });
    }

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as TradeProposeResponse | { ok: false; error: string };
    if ('ok' in data && data.ok === false) {
      return;
    }

    if (!('trade' in data)) {
      return;
    }

    setTrade(data.trade);
    setTradeInsights({
      simulation: data.simulation,
      tradeBalance: data.tradeBalance,
      proposal: data.proposal,
    });
    setProposalStatus(
      data.accepted
        ? 'Trade accepted! Player rights transferred and cap space updated.'
        : 'Trade rejected. Add value to the incoming side.',
    );
    if (data.accepted) {
      pushAlert(buildChantAlert(teamAbbr, 'BIG_TRADE'));
      const previousRoster = userRoster;
      const acquiredPlayerIds = new Set(
        data.trade.receiveAssets
          .filter((asset) => asset.type === 'player' && asset.playerId)
          .map((asset) => asset.playerId as string),
      );

      const userRosterParams = new URLSearchParams({ saveId: actionableSaveId });
      if (teamAbbr) {
        userRosterParams.set('teamAbbr', teamAbbr);
      }
      const userRosterResponse = await apiFetch(`/api/roster?${userRosterParams.toString()}`);
      if (userRosterResponse.ok) {
        const nextRoster = (await userRosterResponse.json()) as PlayerRowDTO[];
        setUserRoster(nextRoster);
        setRoster(nextRoster);
        dispatchSaveDataUpdated({
          saveId: actionableSaveId,
          teamAbbr,
          reason: 'trade-accepted',
        });
        trackProgress(
          `trade:${data.trade.id}`,
          OFFSEASON_PROGRESS_POINTS.manage.trade,
          'Completed a trade to reshape the roster.',
        );
        if (capSpace < 0 && data.header.capSpace >= 0) {
          trackProgress(
            'cap-resolved:trade',
            OFFSEASON_PROGRESS_POINTS.manage.cap_resolved,
            'Solved your cap crunch through the trade market.',
          );
        }
        const acquiredPlayer = nextRoster
          .filter((player) => acquiredPlayerIds.has(player.id))
          .sort(
            (left, right) => (resolvePlayerRating(right) ?? -1) - (resolvePlayerRating(left) ?? -1),
          )[0];
        if (acquiredPlayer) {
          const reactionToast = buildStarReactionToastPayload({
            incomingPlayer: acquiredPlayer,
            roster: nextRoster,
            actionType: 'trade',
            teamAbbr,
            teamName: selectedTeam?.name,
          });
          if (reactionToast) {
            pushToast({
              id: `star-reaction:trade:${actionableSaveId}:${trade.id}:${acquiredPlayer.id}`,
              kind: 'starReaction',
              durationMs: 5200,
              starReaction: reactionToast,
            });
          }
          const chainReaction = generateChainReactionEffects({
            beforeRoster: previousRoster,
            afterRoster: nextRoster,
            beforeCapSpace: capSpace,
            afterCapSpace: data.header.capSpace,
            moveType: 'trade',
            player: acquiredPlayer,
          });
          if (chainReaction) {
            pushToast({
              id: `chain-reaction:trade:${actionableSaveId}:${trade.id}:${acquiredPlayer.id}`,
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
      }

      const partnerRosterParams = new URLSearchParams({
        saveId: actionableSaveId,
        teamAbbr: partnerTeamAbbr,
      });
      const partnerRosterResponse = await apiFetch(`/api/roster?${partnerRosterParams.toString()}`);
      if (partnerRosterResponse.ok) {
        const nextPartnerRoster = (await partnerRosterResponse.json()) as PlayerRowDTO[];
        setPartnerRoster(nextPartnerRoster);
      }
    }
    await refreshSaveHeader();
  };

  const partnerTeam = teams.find((team) => team.abbr === partnerTeamAbbr);
  const partnerTeamOptions = teams.filter((team) => team.abbr !== selectedTeam?.abbr);
  const sendSlots = useMemo(() => {
    const assets = trade?.sendAssets ?? [];
    const used = new Set<string>();
    const slots = sendSlotIds.map((id) => {
      if (!id) return null;
      const asset = assets.find((item) => item.id === id) ?? null;
      if (asset) used.add(asset.id);
      return asset;
    });
    let fillIndex = 0;
    while (fillIndex < slots.length) {
      if (!slots[fillIndex]) {
        const next = assets.find((asset) => !used.has(asset.id)) ?? null;
        if (!next) break;
        slots[fillIndex] = next;
        used.add(next.id);
      }
      fillIndex += 1;
    }
    return slots;
  }, [sendSlotIds, trade?.sendAssets]);
  const receiveSlots = useMemo(() => {
    const assets = trade?.receiveAssets ?? [];
    const used = new Set<string>();
    const slots = receiveSlotIds.map((id) => {
      if (!id) return null;
      const asset = assets.find((item) => item.id === id) ?? null;
      if (asset) used.add(asset.id);
      return asset;
    });
    let fillIndex = 0;
    while (fillIndex < slots.length) {
      if (!slots[fillIndex]) {
        const next = assets.find((asset) => !used.has(asset.id)) ?? null;
        if (!next) break;
        slots[fillIndex] = next;
        used.add(next.id);
      }
      fillIndex += 1;
    }
    return slots;
  }, [receiveSlotIds, trade?.receiveAssets]);

  const buildSlotAsset = (
    asset: TradeAsset | null,
    roster: PlayerRowDTO[],
  ): TradeSlotAsset | null => {
    if (!asset) {
      return null;
    }
    if (asset.type === 'player') {
      const player = roster.find((item) => item.id === asset.playerId);
      return {
        id: asset.id,
        type: 'player',
        label: player ? `${player.firstName} ${player.lastName}` : asset.label,
        sublabel: player ? `${player.position} · ${player.capHit}` : asset.label,
        headshotUrl: player?.headshotUrl,
      };
    }
    return {
      id: asset.id,
      type: 'pick',
      label: asset.label,
      sublabel: asset.pickId ? `${asset.pickId.toUpperCase()}` : 'Draft Pick',
    };
  };

  const openPicker = async (
    side: 'send' | 'receive',
    slotIndex: number,
    replaceAsset?: TradeAsset,
  ) => {
    if (!replaceAsset) {
      if (side === 'send' && (trade?.sendAssets.length ?? 0) >= 5) {
        return;
      }
      if (side === 'receive' && (trade?.receiveAssets.length ?? 0) >= 5) {
        return;
      }
    }

    setAssetPickerLoadingMessage('Loading trade assets...');
    await refreshTradeAssets();
    setDuplicateMessage(null);
    setActiveModalSide(side);
    setActiveSlotIndex(slotIndex);
    setPendingReplace(replaceAsset ? { side, asset: replaceAsset } : null);
    setAssetPickerLoadingMessage(null);
  };

  const manageSubsteps = OFFSEASON_STEPS[0]?.substeps ?? [];
  const canContinueInFull =
    mode !== 'full' || manageSubsteps.every((substep) => manageSubstepsCompleted.includes(substep));

  const handleContinue = () => {
    if (mode !== 'full' || currentStep !== 'manage') return;
    if (saveId) {
      recordProgressEvent({
        saveId,
        step: 'manage',
        eventKey: 'continue:manage',
        complete: true,
      });
    }
    const nextStep = completeCurrentStep();
    if (nextStep) router.push(getRouteForStep(nextStep));
  };

  const handleSkip = () => {
    if (mode !== 'full' || currentStep !== 'manage') return;
    if (saveId) {
      recordProgressEvent({
        saveId,
        step: 'manage',
        eventKey: 'skip:manage:trade-hub',
        complete: true,
        skipped: true,
      });
      pushToast({
        id: `progress:${saveId}:skip:manage:trade-hub`,
        kind: 'progress',
        durationMs: 3200,
        progress: {
          message: 'Completed the Manage Team step.',
          detail: 'Manage Team',
        },
      });
    }
    const nextStep = skipCurrentStep();
    if (nextStep) router.push(getRouteForStep(nextStep));
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    if (phase === 'free_agency') {
      router.push('/free-agents');
      return;
    }

    if (phase === 'draft') {
      router.push('/draft/room?mode=mock');
      return;
    }

    router.push('/roster');
  };

  return (
    <AppShell>
      {mode === 'full' ? (
        <StepHeader
          title="Manage Team"
          stepNumber={1}
          totalSteps={OFFSEASON_STEPS.length}
          instruction="Use Trade Hub to complete your team management step."
          canContinue={canContinueInFull}
          onContinue={handleContinue}
          onSkip={handleSkip}
        />
      ) : null}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={handleBack}
              className="mb-5 inline-flex items-center gap-2 text-sm font-medium transition hover:opacity-80"
              style={{ color: selectedTeam?.color_primary ?? 'var(--team-primary)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Trade Builder
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Build a roster trade</h1>
            <p className="text-sm text-muted-foreground">
              Add players and picks to balance the deal.
            </p>
          </div>
          <Button type="button" onClick={handlePropose} disabled={!trade}>
            Propose Trade
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Acceptance Meter</p>
            </div>
            <div className="w-full max-w-md">
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className={cn(
                    'h-2 rounded-full transition-colors',
                    acceptance < 40
                      ? 'bg-red-500'
                      : acceptance < 70
                        ? 'bg-amber-400'
                        : 'bg-emerald-500',
                  )}
                  style={{ width: `${acceptance}%` }}
                />
              </div>
            </div>
          </div>
          {proposalStatus ? (
            <p className="mt-4 text-sm font-medium text-foreground">{proposalStatus}</p>
          ) : null}
          {tradeInsights ? (
            <div className="mt-4 space-y-2 text-sm text-foreground">
              <p>
                {tradeInsights.simulation.teams.sending.capDelta >= 0
                  ? `You save $${tradeInsights.simulation.teams.sending.capDelta.toFixed(1)}M`
                  : `This adds $${Math.abs(tradeInsights.simulation.teams.sending.capDelta).toFixed(1)}M cap hit`}
              </p>
              <p>
                Partner cap after trade: $
                {tradeInsights.simulation.teams.receiving.resultingCapSpace.toFixed(1)}M
              </p>
              <p>
                Value comparison: outgoing {tradeInsights.tradeBalance.outgoingValue.toFixed(1)} vs
                incoming {tradeInsights.tradeBalance.incomingValue.toFixed(1)} (
                {tradeInsights.tradeBalance.explanation})
              </p>
              {!tradeInsights.proposal.isValid
                ? tradeInsights.proposal.validationErrors.map((error) => (
                    <p key={error.message} className="text-red-600">
                      Trade invalid: {error.message}
                    </p>
                  ))
                : null}
              {tradeInsights.simulation.warnings.map((warning) => (
                <p key={warning} className="text-amber-600">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Your Offer
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {selectedTeam?.name ?? 'Your team'}
                </p>
              </div>
            </div>
            <TradeAssetSlots
              title="YOUR OFFER"
              subtitle="Send assets"
              slots={sendSlots.map((asset) => buildSlotAsset(asset, userRoster))}
              onAdd={(index) => {
                void openPicker('send', index);
              }}
              onReplace={(index) => setSlotAction({ side: 'send', slotIndex: index })}
              onRemove={(index) => {
                const asset = trade?.sendAssets[index];
                if (!asset) return;
                setSendSlotIds((prev) => {
                  const next = [...prev];
                  next[index] = null;
                  return next;
                });
                handleRemoveAsset({
                  side: 'send',
                  assetId: asset.id,
                  playerId: asset.playerId,
                  pickId: asset.pickId,
                });
              }}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Their Offer
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {partnerTeam?.name ?? 'Trade partner'}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 min-w-[220px] items-center justify-between gap-3 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {partnerTeam?.logoUrl ? (
                        <Image
                          src={partnerTeam.logoUrl}
                          alt={`${partnerTeam.name} logo`}
                          width={18}
                          height={18}
                          className="h-[18px] w-[18px] shrink-0 object-contain"
                        />
                      ) : null}
                      <span className="truncate">{partnerTeam?.name ?? 'Trade partner'}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[260px]">
                  {partnerTeamOptions.map((team) => (
                    <DropdownMenuItem
                      key={team.abbr}
                      className="gap-2"
                      onClick={() => setPartnerTeamAbbr(team.abbr)}
                    >
                      {team.logoUrl ? (
                        <Image
                          src={team.logoUrl}
                          alt={`${team.name} logo`}
                          width={18}
                          height={18}
                          className="h-[18px] w-[18px] shrink-0 object-contain"
                        />
                      ) : null}
                      <span className="truncate">{team.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <TradeAssetSlots
              title="THEIR OFFER"
              subtitle="Receive assets"
              slots={receiveSlots.map((asset) => buildSlotAsset(asset, partnerRoster))}
              onAdd={(index) => {
                void openPicker('receive', index);
              }}
              onReplace={(index) => setSlotAction({ side: 'receive', slotIndex: index })}
              onRemove={(index) => {
                const asset = trade?.receiveAssets[index];
                if (!asset) return;
                setReceiveSlotIds((prev) => {
                  const next = [...prev];
                  next[index] = null;
                  return next;
                });
                handleRemoveAsset({
                  side: 'receive',
                  assetId: asset.id,
                  playerId: asset.playerId,
                  pickId: asset.pickId,
                });
              }}
            />
          </div>
        </div>
      </div>

      <TradeAssetPickerModal
        isOpen={activeModalSide !== null && activeSlotIndex !== null}
        title={activeModalSide === 'send' ? 'Add to Your Offer' : 'Add to Their Offer'}
        players={activeModalSide === 'send' ? userRoster : partnerRoster}
        picks={activeModalSide === 'send' ? userDraftPicks : partnerDraftPicks}
        loadingMessage={assetPickerLoadingMessage}
        duplicateMessage={duplicateMessage}
        onClose={() => {
          setActiveModalSide(null);
          setActiveSlotIndex(null);
          setDuplicateMessage(null);
          setPendingReplace(null);
        }}
        onSelectPlayer={(player) => {
          if (!trade || !activeModalSide) return;
          const assets = activeModalSide === 'send' ? trade.sendAssets : trade.receiveAssets;
          if (assets.some((asset) => asset.playerId === player.id)) {
            setDuplicateMessage('That player is already in the offer.');
            return;
          }
          const assetId = `asset-${activeModalSide}-player-${player.id}`;
          if (activeSlotIndex !== null) {
            if (activeModalSide === 'send') {
              setSendSlotIds((prev) => {
                const next = [...prev];
                next[activeSlotIndex] = assetId;
                return next;
              });
            } else {
              setReceiveSlotIds((prev) => {
                const next = [...prev];
                next[activeSlotIndex] = assetId;
                return next;
              });
            }
          }
          if (pendingReplace) {
            handleRemoveAsset({
              side: pendingReplace.side,
              assetId: pendingReplace.asset.id,
              playerId: pendingReplace.asset.playerId,
              pickId: pendingReplace.asset.pickId,
            });
          }
          handleAddAsset({ side: activeModalSide, type: 'player', playerId: player.id });
        }}
        onSelectPick={(pickId) => {
          if (!trade || !activeModalSide) return;
          const assets = activeModalSide === 'send' ? trade.sendAssets : trade.receiveAssets;
          if (assets.some((asset) => asset.pickId === pickId)) {
            setDuplicateMessage('That pick is already in the offer.');
            return;
          }
          const assetId = `asset-${activeModalSide}-pick-${pickId}`;
          if (activeSlotIndex !== null) {
            if (activeModalSide === 'send') {
              setSendSlotIds((prev) => {
                const next = [...prev];
                next[activeSlotIndex] = assetId;
                return next;
              });
            } else {
              setReceiveSlotIds((prev) => {
                const next = [...prev];
                next[activeSlotIndex] = assetId;
                return next;
              });
            }
          }
          if (pendingReplace) {
            handleRemoveAsset({
              side: pendingReplace.side,
              assetId: pendingReplace.asset.id,
              playerId: pendingReplace.asset.playerId,
              pickId: pendingReplace.asset.pickId,
            });
          }
          handleAddAsset({ side: activeModalSide, type: 'pick', pickId });
        }}
      />

      {slotAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">Modify slot</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Would you like to replace this asset or remove it from the offer?
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  setSlotAction(null);
                  const assets =
                    slotAction.side === 'send' ? trade?.sendAssets : trade?.receiveAssets;
                  const asset = assets?.[slotAction.slotIndex];
                  if (asset) {
                    void openPicker(slotAction.side, slotAction.slotIndex, asset);
                  }
                }}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const assets =
                    slotAction.side === 'send' ? trade?.sendAssets : trade?.receiveAssets;
                  const asset = assets?.[slotAction.slotIndex];
                  if (asset) {
                    if (slotAction.side === 'send') {
                      setSendSlotIds((prev) => {
                        const next = [...prev];
                        next[slotAction.slotIndex] = null;
                        return next;
                      });
                    } else {
                      setReceiveSlotIds((prev) => {
                        const next = [...prev];
                        next[slotAction.slotIndex] = null;
                        return next;
                      });
                    }
                    handleRemoveAsset({
                      side: slotAction.side,
                      assetId: asset.id,
                      playerId: asset.playerId,
                      pickId: asset.pickId,
                    });
                  }
                  setSlotAction(null);
                }}
              >
                Remove
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSlotAction(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function TradeBuilderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TradeBuilderContent />
    </Suspense>
  );
}
