'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, ArrowUpDown, Handshake, MoreHorizontal, Users } from 'lucide-react';

import AppShell from '@/components/app-shell';
import CutPlayerModal from '@/components/cut-player-modal';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import { PlayerTable, PositionFilterBar } from '@/components/player-table';
import PlayerTypeIcon from '@/components/player-type-icon';
import { TradeBlockTable } from '@/components/trade-block-table';
import ResignPlayerModal from '@/components/resign-player-modal';
import { StepHeader } from '@/components/offseason/step-header';
import ResignOfferResultModal from '@/components/resign-offer-result-modal';
import RenegotiateModal from '@/components/renegotiate-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { useExpiringContractsQuery } from '@/features/contracts/queries';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useRosterQuery } from '@/features/players/queries';
import { useTradeBlockQuery } from '@/features/trades/queries';
import { useTradeOfferOrchestrator } from '@/features/trades/use-trade-offer-orchestrator';
import { useExperienceStore } from '@/features/experience/experience-store';
import { OFFSEASON_STEPS } from '@/features/experience/offseason-steps';
import { getRouteForStep } from '@/features/experience/experience-utils';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { buildChantAlert } from '@/lib/falco-alerts';
import { generateLeagueBuzzToast } from '@/lib/league-buzz';
import { getTeamCatchphrase } from '@/lib/team-chants';
import { apiFetch } from '@/lib/api';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';
import { useOnboarding } from '@/hooks/useOnboarding';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import type { PlayerRowDTO } from '@/types/player';
import type { ResignResultDTO } from '@/types/resign';
import type { RenegotiateResultDTO } from '@/types/renegotiate';
import type { TradeBlockRow } from '@/types/trade-block';

const getInterestTier = (interest: number) => {
  if (interest >= 85) return { label: 'Very High', barClass: 'bg-emerald-500' };
  if (interest >= 65) return { label: 'High', barClass: 'bg-emerald-400' };
  if (interest >= 40) return { label: 'Medium', barClass: 'bg-amber-400' };
  return { label: 'Low', barClass: 'bg-rose-400' };
};

const VISIT_TRADE_OFFER_INTERACTION_THRESHOLD = 3;

const getReadableTextColor = (backgroundColor?: string | null) => {
  if (!backgroundColor) return '#ffffff';
  const normalized = backgroundColor.replace('#', '');
  if (normalized.length !== 6) return '#ffffff';

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return '#ffffff';
  }

  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? '#0f172a' : '#ffffff';
};

export default function RosterPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const phase = useSaveStore((state) => state.phase);
  const unlocked = useSaveStore((state) => state.unlocked);
  const cachedRoster = useSaveStore((state) => state.roster);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const setRoster = useSaveStore((state) => state.setRoster);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const { data: rosterData, isLoading: isRosterLoading } = useRosterQuery(saveId, teamAbbr);
  const {
    data: expiringData,
    isLoading: isExpiringLoading,
    error: expiringError,
  } = useExpiringContractsQuery(
    phase === 'resign_cut' ? saveId : null,
    phase === 'resign_cut' ? teamAbbr : null,
  );
  const {
    data: tradeBlockData,
    isLoading: isTradeBlockLoading,
    error: tradeBlockError,
  } = useTradeBlockQuery(phase === 'resign_cut' ? saveId : null, teamAbbr);
  const [players, setPlayers] = useState<PlayerRowDTO[]>(() =>
    rosterData.length > 0 ? rosterData : cachedRoster,
  );
  const [activeCutPlayer, setActiveCutPlayer] = useState<PlayerRowDTO | null>(null);
  const [activeResignPlayer, setActiveResignPlayer] = useState<PlayerRowDTO | null>(null);
  const [activeRenegotiatePlayer, setActiveRenegotiatePlayer] = useState<PlayerRowDTO | null>(null);
  const [activeExpiringContract, setActiveExpiringContract] = useState<ExpiringContractRow | null>(
    null,
  );
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContractRow[]>(
    () => expiringData,
  );
  const [expiringPositionFilter, setExpiringPositionFilter] = useState('All');
  const [expiringSearchQuery, setExpiringSearchQuery] = useState('');
  const [expiringSort, setExpiringSort] = useState<{
    key: 'rating' | 'name' | 'pos' | 'status' | 'interest';
    desc: boolean;
  }>({
    key: 'rating',
    desc: true,
  });
  const [resignResult, setResignResult] = useState<ResignResultDTO | null>(null);
  const [isResignResultOpen, setIsResignResultOpen] = useState(false);
  const [renegotiateResult, setRenegotiateResult] = useState<RenegotiateResultDTO | null>(null);
  const [isRenegotiateResultOpen, setIsRenegotiateResultOpen] = useState(false);
  const [renegotiateResultPlayer, setRenegotiateResultPlayer] = useState<PlayerRowDTO | null>(null);
  const [tradeBlockPlayers, setTradeBlockPlayers] = useState<TradeBlockRow[]>(() => tradeBlockData);
  const [activeTab, setActiveTab] = useState<'expiring' | 'tradeBlock' | 'roster'>('expiring');
  const { push: pushToast } = useToast();
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);
  const mode = useExperienceStore((state) => state.mode);
  const currentStep = useExperienceStore((state) => state.currentStep);
  const manageSubstepsCompleted = useExperienceStore((state) => state.manageSubstepsCompleted);
  const markManageSubstepComplete = useExperienceStore((state) => state.markManageSubstepComplete);
  const completeCurrentStep = useExperienceStore((state) => state.completeCurrentStep);
  const skipCurrentStep = useExperienceStore((state) => state.skipCurrentStep);
  const rosterFirstVisibleRowLoggedRef = useRef(false);
  const expiringFirstVisibleRowLoggedRef = useRef(false);
  const rosterStartedAtRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0,
  );
  const expiringStartedAtRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0,
  );
  const tradeOfferShownForVisitRef = useRef<string | null>(null);
  const lastTradeOfferAttemptBucketRef = useRef<string | null>(null);
  const [rosterInteractionCount, setRosterInteractionCount] = useState(0);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId),
    [selectedTeamId, teams],
  );
  const {
    isOpen: isOnboardingOpen,
    currentStep: onboardingStep,
    totalSteps: onboardingTotalSteps,
    next: advanceOnboarding,
    previous: retreatOnboarding,
    skip: skipOnboarding,
  } = useOnboarding({
    enabled: true,
    stepCount: 3,
  });
  const onboardingPrimaryColor = selectedTeam?.color_primary ?? '#0f172a';
  const onboardingPrimaryTextColor = getReadableTextColor(onboardingPrimaryColor);
  const hasBlockingModalOpen = Boolean(
    isOnboardingOpen ||
      activeCutPlayer ||
      activeResignPlayer ||
      activeExpiringContract ||
      activeRenegotiatePlayer ||
      isResignResultOpen ||
      isRenegotiateResultOpen,
  );
  const renderExpiringHeader = (
    label: string,
    key: 'rating' | 'name' | 'pos' | 'status' | 'interest',
  ) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase text-muted-foreground"
      onClick={() => toggleExpiringSort(key)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );
  const ensureActionableSaveId = async (preferredSaveId?: string | null) => {
    return ensureRecoverableSaveId(
      {
        preferredSaveId: preferredSaveId ?? saveId,
        teamId,
        teamAbbr,
        capSpace,
        capLimit,
        roster: cachedRoster,
        phase,
        unlocked,
      },
      setSaveHeader,
    );
  };
  const requestTradeOffer = useTradeOfferOrchestrator({
    enabled: phase === 'resign_cut',
    phase: 'manage',
    saveId,
    teamAbbr,
    ensureActionableSaveId,
  });

  useEffect(() => {
    setPlayers(rosterData);
    if (rosterData.length > 0) {
      setRoster(rosterData);
    }
  }, [rosterData, setRoster]);

  useEffect(() => {
    setExpiringContracts(expiringData);
  }, [expiringData]);

  useEffect(() => {
    setTradeBlockPlayers(tradeBlockData);
  }, [tradeBlockData]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (rosterFirstVisibleRowLoggedRef.current || players.length === 0) return;
    rosterFirstVisibleRowLoggedRef.current = true;
    console.info('[player-list] roster:first-row-visible', {
      count: players.length,
      ms: Number((performance.now() - rosterStartedAtRef.current).toFixed(1)),
    });
  }, [players]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (expiringFirstVisibleRowLoggedRef.current || expiringContracts.length === 0) return;
    expiringFirstVisibleRowLoggedRef.current = true;
    console.info('[player-list] expiring:first-row-visible', {
      count: expiringContracts.length,
      ms: Number((performance.now() - expiringStartedAtRef.current).toFixed(1)),
    });
  }, [expiringContracts]);

  useEffect(() => {
    if (phase !== 'resign_cut') return;
    setRosterInteractionCount(0);
    tradeOfferShownForVisitRef.current = null;
    lastTradeOfferAttemptBucketRef.current = null;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'resign_cut' || hasBlockingModalOpen) return;

    const registerInteraction = () => {
      setRosterInteractionCount((current) => current + 1);
    };

    window.addEventListener('pointerdown', registerInteraction, { passive: true });
    window.addEventListener('wheel', registerInteraction, { passive: true });
    window.addEventListener('keydown', registerInteraction);

    return () => {
      window.removeEventListener('pointerdown', registerInteraction);
      window.removeEventListener('wheel', registerInteraction);
      window.removeEventListener('keydown', registerInteraction);
    };
  }, [hasBlockingModalOpen, phase]);

  useEffect(() => {
    if (
      phase !== 'resign_cut' ||
      !saveId ||
      !teamAbbr ||
      hasBlockingModalOpen ||
      rosterInteractionCount < VISIT_TRADE_OFFER_INTERACTION_THRESHOLD
    ) {
      return;
    }
    const requestKey = `${saveId}:${teamAbbr}`;
    if (tradeOfferShownForVisitRef.current === requestKey) return;

    const attemptBucket = Math.floor(
      rosterInteractionCount / VISIT_TRADE_OFFER_INTERACTION_THRESHOLD,
    );
    const attemptKey = `${requestKey}:${attemptBucket}`;
    if (lastTradeOfferAttemptBucketRef.current === attemptKey) return;
    lastTradeOfferAttemptBucketRef.current = attemptKey;

    void (async () => {
      const wasShown = await requestTradeOffer({ trigger: 'visit-manage-team' });
      if (wasShown) {
        tradeOfferShownForVisitRef.current = requestKey;
      }
    })();
  }, [hasBlockingModalOpen, phase, requestTradeOffer, rosterInteractionCount, saveId, teamAbbr]);

  const handleSubmitCut = async () => {
    if (!activeCutPlayer) {
      return;
    }

    const actionableSaveId = await ensureActionableSaveId(saveId);

    if (!actionableSaveId) {
      pushToast({
        title: 'Session not initialized',
        description: 'Please return to Team Select to start a new offseason.',
        variant: 'error',
      });
      return;
    }

    const response = await apiFetch('/api/actions/cut-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId,
        playerId: activeCutPlayer.id,
        teamId: teamId || undefined,
        teamAbbr: teamAbbr || undefined,
      }),
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      header?: {
        id: string;
        teamAbbr: string;
        capSpace: number;
        capLimit: number;
        rosterCount: number;
        rosterLimit: number;
        phase: string;
        unlocked?: { freeAgency: boolean; draft: boolean };
        createdAt: string;
      };
      player?: PlayerRowDTO;
    };
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Unable to cut player right now.');
    }

    if (data.player) {
      setPlayers((prev) => {
        const next = prev.map((item) => (item.id === data.player?.id ? data.player : item));
        setRoster(next);
        return next;
      });
    }
    if (data.header) {
      setSaveHeader({
        ...data.header,
        unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
      });
    }
    const capSavings = data.player?.releaseSavings ?? activeCutPlayer.releaseSavings ?? 0;
    if (capSavings > 10) {
      const leagueBuzz = generateLeagueBuzzToast({
        eventType: 'capClearingCut',
        teamName: selectedTeam?.name ?? teamAbbr ?? 'Your team',
        playerName: `${activeCutPlayer.firstName} ${activeCutPlayer.lastName}`,
        capSavings,
        teamAbbr,
      });
      if (leagueBuzz) {
        pushToast({
          id: `league-buzz:cut:${actionableSaveId}:${activeCutPlayer.id}`,
          kind: 'leagueBuzz',
          durationMs: 5600,
          leagueBuzz,
        });
      }
    }
    setActiveCutPlayer(null);
    void requestTradeOffer({ trigger: 'after-cut', force: true });
    if (mode === 'full') {
      markManageSubstepComplete('Re-sign / Cut Players');
    }
  };

  const filteredExpiringContracts = useMemo(() => {
    const search = expiringSearchQuery.trim().toLowerCase();
    return expiringContracts
      .filter((player) => {
        const matchesPosition =
          expiringPositionFilter === 'All' || player.pos === expiringPositionFilter;
        const matchesSearch = search.length === 0 || player.name.toLowerCase().includes(search);
        return matchesPosition && matchesSearch;
      })
      .sort((a, b) => {
        const compareStrings = (left: string, right: string) => left.localeCompare(right);
        const compareNumbers = (
          left: number | null | undefined,
          right: number | null | undefined,
        ) => {
          const normalizedLeft = left ?? null;
          const normalizedRight = right ?? null;
          if (normalizedLeft === null && normalizedRight !== null) return 1;
          if (normalizedLeft !== null && normalizedRight === null) return -1;
          if (normalizedLeft === null && normalizedRight === null) return 0;
          return (normalizedLeft ?? 0) - (normalizedRight ?? 0);
        };

        const multiplier = expiringSort.desc ? -1 : 1;
        let result = 0;

        switch (expiringSort.key) {
          case 'name':
            result = compareStrings(a.name, b.name);
            break;
          case 'pos':
            result = compareStrings(a.pos, b.pos) || compareStrings(a.name, b.name);
            break;
          case 'status':
            result = compareStrings('Pending', 'Pending') || compareStrings(a.name, b.name);
            break;
          case 'interest':
            result =
              compareNumbers(a.interestPct ?? null, b.interestPct ?? null) ||
              compareStrings(a.name, b.name);
            break;
          case 'rating':
          default:
            result =
              compareNumbers(a.rating ?? null, b.rating ?? null) || compareStrings(a.name, b.name);
            break;
        }

        return result * multiplier;
      });
  }, [expiringContracts, expiringPositionFilter, expiringSearchQuery, expiringSort]);

  const toggleExpiringSort = (key: 'rating' | 'name' | 'pos' | 'status' | 'interest') => {
    setExpiringSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : { key, desc: key === 'name' || key === 'pos' || key === 'status' ? false : true },
    );
  };

  const resetExpiringFilters = () => {
    setExpiringPositionFilter('All');
    setExpiringSearchQuery('');
    setExpiringSort({ key: 'rating', desc: true });
  };

  const expiringResignPlayer = useMemo<PlayerRowDTO | null>(() => {
    if (!activeExpiringContract) {
      return null;
    }

    const nameParts = activeExpiringContract.name.split(' ');
    const firstName = nameParts[0] ?? activeExpiringContract.name;
    const lastName = nameParts.slice(1).join(' ') || activeExpiringContract.name;

    return {
      id: activeExpiringContract.id,
      firstName,
      lastName,
      position: activeExpiringContract.pos,
      age: activeExpiringContract.age,
      rating: activeExpiringContract.rating,
      headshotUrl: activeExpiringContract.headshotUrl ?? null,
      contractYearsRemaining: 0,
      capHit: '',
      status: 'expiring',
    };
  }, [activeExpiringContract]);

  const handleSubmitResign = async (offer: { years: number; apy: number; guaranteed: number }) => {
    if (!activeResignPlayer && !activeExpiringContract) {
      return;
    }

    const playerId = activeResignPlayer?.id ?? activeExpiringContract?.id;
    if (!playerId) {
      return;
    }

    const actionableSaveId = await ensureActionableSaveId(saveId);

    if (!actionableSaveId) {
      pushToast({
        title: 'Session not initialized',
        description: 'Please return to Team Select to start a new offseason.',
        variant: 'error',
      });
      return;
    }

    const requestBody = {
      saveId: actionableSaveId,
      teamAbbr,
      playerId,
      years: offer.years,
      apy: offer.apy,
      guaranteed: offer.guaranteed,
    };

    const submitResign = (body: typeof requestBody) =>
      apiFetch('/api/actions/resign-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    let response = await submitResign(requestBody);

    if (response.status === 404) {
      const errorPayload = (await response.json()) as { ok?: boolean; error?: string };
      if (errorPayload.error === 'Save not found') {
        const recoveredSaveId = await ensureActionableSaveId(null);
        if (!recoveredSaveId) {
          throw new Error(errorPayload.error || 'Please try again in a moment.');
        }

        response = await submitResign({
          ...requestBody,
          saveId: recoveredSaveId,
        });
      } else {
        throw new Error(errorPayload.error || 'Please try again in a moment.');
      }
    }

    if (!response.ok) {
      const errorPayload = (await response.json()) as { ok?: boolean; error?: string };
      const message = errorPayload.error || 'Please try again in a moment.';
      pushToast({
        title: 'Unable to submit offer',
        description: message,
        variant: 'error',
      });
      throw new Error(message);
    }

    const data = (await response.json()) as ResignResultDTO | { ok: false; error: string };
    if (!data.ok) {
      const message = data.error || 'Please try again in a moment.';
      pushToast({
        title: 'Unable to submit offer',
        description: message,
        variant: 'error',
      });
      throw new Error(message);
    }

    setResignResult(data);
    setIsResignResultOpen(true);
    pushToast({
      title: data.accepted ? 'Offer accepted' : 'Offer declined',
      description: data.accepted ? data.newsItem.details : 'The player decided to test the market.',
      variant: data.accepted ? 'success' : 'error',
    });
    if (data.accepted) {
      pushAlert(buildChantAlert(teamAbbr, 'BIG_SIGNING'));
    }

    if (data.accepted) {
      const wasExpiringResign = Boolean(activeExpiringContract);
      if (data.header) {
        setSaveHeader({
          ...data.header,
          unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
        });
      }
      if (data.player) {
        const updatedPlayer = data.player;
        setPlayers((prev) => {
          const exists = prev.some((item) => item.id === updatedPlayer.id);
          const next = exists
            ? prev.map((item) => (item.id === updatedPlayer.id ? updatedPlayer : item))
            : [updatedPlayer, ...prev];
          setRoster(next);
          return next;
        });
        if (wasExpiringResign) {
          const leagueBuzz = generateLeagueBuzzToast({
            eventType: 'resign',
            teamName: selectedTeam?.name ?? teamAbbr ?? 'Your team',
            playerName: `${updatedPlayer.firstName} ${updatedPlayer.lastName}`,
            teamAbbr,
          });
          if (leagueBuzz) {
            pushToast({
              id: `league-buzz:resign:${actionableSaveId}:${updatedPlayer.id}`,
              kind: 'leagueBuzz',
              durationMs: 5600,
              leagueBuzz,
            });
          }
        }
      }
      if (activeExpiringContract) {
        setExpiringContracts((prev) =>
          prev.filter((contract) => contract.id !== activeExpiringContract.id),
        );
      }
    }

    setActiveResignPlayer(null);
    setActiveExpiringContract(null);
    void requestTradeOffer({ trigger: data.accepted ? 'after-resign-accepted' : 'after-resign-declined' });
    return;
  };

  const handleSubmitRenegotiate = async (offer: {
    years: number;
    apy: number;
    guaranteed: number;
  }) => {
    if (!activeRenegotiatePlayer) {
      return;
    }

    const actionableSaveId = await ensureActionableSaveId(saveId);

    if (!actionableSaveId) {
      pushToast({
        title: 'Session not initialized',
        description: 'Please return to Team Select to start a new offseason.',
        variant: 'error',
      });
      return;
    }

    const requestBody = {
      saveId: actionableSaveId,
      teamAbbr,
      playerId: activeRenegotiatePlayer.id,
      years: offer.years,
      apy: offer.apy,
      guaranteed: offer.guaranteed,
    };

    const submitRenegotiate = (body: typeof requestBody) =>
      apiFetch(
        '/api/roster/renegotiate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        { skipSaveGuard: true },
      );

    let response = await submitRenegotiate(requestBody);

    if (response.status === 404) {
      const errorPayload = (await response.json()) as { ok?: boolean; error?: string };
      if (errorPayload.error === 'Save not found') {
        const recoveredSaveId = await ensureActionableSaveId(null);
        if (!recoveredSaveId) {
          throw new Error(errorPayload.error || 'Unable to renegotiate right now.');
        }

        response = await submitRenegotiate({
          ...requestBody,
          saveId: recoveredSaveId,
        });
      } else {
        throw new Error(errorPayload.error || 'Unable to renegotiate right now.');
      }
    }

    const data = (await response.json()) as RenegotiateResultDTO | { ok: false; error: string };
    if (!response.ok || !data.ok) {
      throw new Error(!data.ok ? data.error : 'Unable to renegotiate right now.');
    }

    setRenegotiateResult(data);
    setRenegotiateResultPlayer(activeRenegotiatePlayer);
    setIsRenegotiateResultOpen(true);
    pushToast({
      title: data.accepted ? 'Renegotiation accepted' : 'Renegotiation declined',
      description: data.accepted ? 'Contract updated.' : data.quote,
      variant: data.accepted ? 'success' : 'error',
    });

    if (data.header) {
      setSaveHeader({
        ...data.header,
        unlocked: data.header.unlocked ?? { freeAgency: false, draft: false },
      });
    }

    if (data.player) {
      setPlayers((prev) => {
        const next = prev.map((item) => (item.id === data.player?.id ? data.player : item));
        setRoster(next);
        return next;
      });
      if (data.accepted) {
        const leagueBuzz = generateLeagueBuzzToast({
          eventType: 'renegotiate',
          teamName: selectedTeam?.name ?? teamAbbr ?? 'Your team',
          playerName: `${data.player.firstName} ${data.player.lastName}`,
          teamAbbr,
        });
        if (leagueBuzz) {
          pushToast({
            id: `league-buzz:renegotiate:${actionableSaveId}:${data.player.id}`,
            kind: 'leagueBuzz',
            durationMs: 5600,
            leagueBuzz,
          });
        }
      }
    }

    setActiveRenegotiatePlayer(null);
    if (data.accepted) {
      void requestTradeOffer({ trigger: 'after-renegotiate', force: true });
    }
    if (mode === 'full') {
      markManageSubstepComplete('Re-sign / Cut Players');
    }
  };

  const manageSubsteps = OFFSEASON_STEPS[0]?.substeps ?? [];
  const canContinueInFull =
    mode !== 'full' || manageSubsteps.every((substep) => manageSubstepsCompleted.includes(substep));

  const handleContinue = () => {
    if (mode !== 'full' || currentStep !== 'manage') return;
    const nextStep = completeCurrentStep();
    if (nextStep) {
      router.push(getRouteForStep(nextStep));
    }
  };

  const handleSkip = () => {
    if (mode !== 'full' || currentStep !== 'manage') return;
    const nextStep = skipCurrentStep();
    if (nextStep) {
      router.push(getRouteForStep(nextStep));
    }
  };

  const sortedPlayers = useMemo(() => {
    const expiringPlayerIds = new Set(expiringContracts.map((player) => player.id));
    const cut = players
      .filter((player) => player.status.toLowerCase() === 'cut')
      .sort((a, b) => {
        const aCut = a.cutAt ? Date.parse(a.cutAt) : 0;
        const bCut = b.cutAt ? Date.parse(b.cutAt) : 0;
        return bCut - aCut;
      });
    const active = players
      .filter(
        (player) =>
          player.status.toLowerCase() !== 'cut' && !expiringPlayerIds.has(player.id),
      )
      .sort((a, b) => (b.capHitValue ?? 0) - (a.capHitValue ?? 0));
    return [...cut, ...active];
  }, [expiringContracts, players]);

  return (
    <AppShell>
      {mode === 'full' ? (
        <StepHeader
          title="Manage Team"
          stepNumber={1}
          totalSteps={OFFSEASON_STEPS.length}
          instruction="Re-sign, cut, and explore trades before entering free agency."
          canContinue={canContinueInFull}
          backgroundColor={selectedTeam?.color_primary}
          onContinue={handleContinue}
          onSkip={handleSkip}
        />
      ) : null}
      {phase === 'resign_cut' ? (
        <div className="mb-6 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                className={`rounded-full px-3 py-1 transition ${
                  activeTab === 'expiring'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
                onClick={() => setActiveTab('expiring')}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Handshake className="h-3.5 w-3.5" aria-hidden="true" />
                  Expiring Contracts
                </span>
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 transition ${
                  activeTab === 'roster'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
                onClick={() => setActiveTab('roster')}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  Roster
                </span>
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 transition ${
                  activeTab === 'tradeBlock'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-white/70'
                }`}
                onClick={() => setActiveTab('tradeBlock')}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ArrowLeftRight
                    className="h-3.5 w-3.5"
                    style={{ color: selectedTeam?.color_primary ?? 'var(--team-primary)' }}
                    aria-hidden="true"
                  />
                  Trade Block
                </span>
              </button>
            </div>
            {activeTab === 'tradeBlock' ? (
              <Button
                type="button"
                className="h-9 rounded-full px-4 text-sm font-semibold"
                style={{ backgroundColor: selectedTeam?.color_primary }}
                onClick={() => router.push('/manage/trades')}
              >
                Propose Trade
              </Button>
            ) : null}
          </div>

          {activeTab === 'expiring' ? (
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <PositionFilterBar
                      active={expiringPositionFilter}
                      onSelect={setExpiringPositionFilter}
                    />
                    <div className="flex w-full max-w-sm items-center gap-2 sm:w-auto">
                      <input
                        type="search"
                        placeholder="Search players..."
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={expiringSearchQuery}
                        onChange={(event) => setExpiringSearchQuery(event.target.value)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={resetExpiringFilters}>
                            Reset filters
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setExpiringSearchQuery('')}>
                            Clear search
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                <div className="py-4 sm:px-6">
                  <div className="px-4 md:hidden">
                    <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      <span>Swipe to see more columns.</span>
                    </div>
                  </div>
                  {isExpiringLoading && expiringContracts.length === 0 ? (
                    <>
                      <div className="mt-3 w-full overflow-x-auto overscroll-x-contain">
                        <table className="min-w-full w-max border-collapse table-fixed md:w-full md:table-auto">
                          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                            <tr>
                              <th className="w-[180px] min-w-[180px] px-4 py-2 text-left sm:px-6 md:w-auto md:min-w-0">
                                Name
                              </th>
                              <th className="w-[64px] min-w-[64px] px-4 py-2 text-left sm:px-6 md:w-auto md:min-w-0">
                                Pos
                              </th>
                              <th className="w-[64px] min-w-[64px] px-4 py-2 text-left sm:px-6 md:w-auto md:min-w-0">
                                Age
                              </th>
                              <th className="w-[112px] min-w-[112px] px-4 py-2 text-left sm:px-6 md:w-auto md:min-w-0">
                                Status
                              </th>
                              <th className="w-[132px] min-w-[132px] px-4 py-2 text-left sm:px-6 md:w-auto md:min-w-0">
                                Interest
                              </th>
                              <th className="sticky right-0 z-20 box-border w-[132px] min-w-[132px] border-l border-slate-200 bg-slate-50 pl-4 pr-2 py-2 text-left shadow-[-8px_0_14px_-14px_rgba(15,23,42,0.18)] md:static md:w-auto md:min-w-0 md:border-l-0 md:bg-transparent md:px-6 md:text-left md:shadow-none">
                                ACTIONS
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: 8 }, (_, index) => (
                              <tr
                                key={`expiring-skeleton-${index}`}
                                className="border-t border-border"
                              >
                                {[
                                  'w-40',
                                  'w-12',
                                  'w-10',
                                  'hidden md:block w-10',
                                  'hidden md:block w-24',
                                ].map((width, cellIndex) => (
                                  <td
                                    key={`${index}-${cellIndex}`}
                                    className="px-4 py-3 align-middle sm:px-6"
                                  >
                                    <div
                                      className={`h-4 animate-pulse rounded bg-slate-200/80 ${width}`}
                                    />
                                  </td>
                                ))}
                                <td className="sticky right-0 z-10 box-border w-[132px] min-w-[132px] border-l border-slate-200 bg-white pl-4 pr-2 py-3 text-left shadow-[-8px_0_14px_-14px_rgba(15,23,42,0.14)] md:static md:w-auto md:min-w-0 md:border-l-0 md:bg-transparent md:px-6 md:text-right md:shadow-none">
                                  <div className="h-4 w-full animate-pulse rounded bg-slate-200/80" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-2 text-xs text-muted-foreground sm:px-6">
                        Loading players...
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-3 w-full overflow-x-auto overscroll-x-contain">
                        <table className="min-w-full w-max border-collapse table-fixed md:min-w-[720px] md:w-full md:table-auto">
                          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                            <tr>
                              <th className="w-[180px] min-w-[180px] px-4 py-2 text-left sm:px-6 md:w-auto md:min-w-0">
                                {renderExpiringHeader('Player', 'name')}
                              </th>
                              <th className="w-[64px] min-w-[64px] px-4 py-2 text-left sm:px-6 md:w-auto md:min-w-0">
                                {renderExpiringHeader('Pos', 'pos')}
                              </th>
                              <th className="w-[64px] min-w-[64px] px-4 py-2 text-left sm:px-6 md:w-auto md:min-w-0">
                                Age
                              </th>
                              <th className="w-[112px] min-w-[112px] px-4 py-2 text-left sm:px-6 md:w-auto md:min-w-0">
                                {renderExpiringHeader('Status', 'status')}
                              </th>
                              <th className="w-[132px] min-w-[132px] px-4 py-2 text-left sm:px-6 md:w-auto md:min-w-0">
                                {renderExpiringHeader('Interest', 'interest')}
                              </th>
                              <th className="sticky right-0 z-20 box-border w-[132px] min-w-[132px] border-l border-slate-200 bg-slate-50 pl-4 pr-2 py-2 text-left shadow-[-8px_0_14px_-14px_rgba(15,23,42,0.18)] md:static md:w-auto md:min-w-0 md:border-l-0 md:bg-transparent md:px-6 md:text-left md:shadow-none">
                                ACTIONS
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredExpiringContracts.map((player) => (
                              <tr
                                key={player.id}
                                className="border-t border-border hover:bg-slate-50/60"
                              >
                                <td className="px-4 py-1.5 text-left text-sm font-semibold text-foreground sm:px-6">
                                  <div className="flex w-full items-start justify-start gap-3 text-left">
                                    <div className="relative shrink-0">
                                      <PlayerTypeIcon
                                        player={{ age: player.age, rating: player.rating }}
                                        className="absolute -left-4 top-1/2 -translate-y-1/2"
                                      />
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                                      {player.headshotUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={player.headshotUrl}
                                          alt={player.name}
                                          className="h-full w-full object-cover"
                                          loading="lazy"
                                          decoding="async"
                                        />
                                      ) : (
                                        `${(player.name.split(' ')[0] ?? player.name).charAt(0)}${(
                                          player.name.split(' ').slice(1).join(' ') || player.name
                                        ).charAt(0)}`.toUpperCase()
                                      )}
                                      </div>
                                    </div>
                                    <div className="min-w-0 flex-1 text-left">
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <div className="truncate leading-tight">{player.name}</div>
                                      </div>
                                      {player.interestQuote ? (
                                        <div
                                          className="line-clamp-2 pt-0.5 text-left text-xs font-normal leading-snug text-muted-foreground"
                                          title={player.interestQuote}
                                        >
                                          {player.interestQuote}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-1.5 text-sm text-muted-foreground sm:px-6">
                                  {player.pos}
                                </td>
                                <td className="px-4 py-1.5 text-sm text-muted-foreground sm:px-6">
                                  {player.age ?? '—'}
                                </td>
                                <td className="px-4 py-1.5 text-sm text-muted-foreground sm:px-6">
                                  <Badge variant="success">Pending</Badge>
                                </td>
                                <td className="px-4 py-1.5 text-sm text-foreground sm:px-6">
                                  {(() => {
                                    const score = Math.max(
                                      0,
                                      Math.min(100, player.interestPct ?? 0),
                                    );
                                    const tier = getInterestTier(score);
                                    return (
                                      <div className="w-32">
                                        <div className="mb-1 text-xs font-medium text-muted-foreground">
                                          {tier.label}
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-slate-200">
                                          <div
                                            className={`h-2 rounded-full ${tier.barClass}`}
                                            style={{ width: `${score}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="sticky right-0 z-10 box-border w-[132px] min-w-[132px] border-l border-slate-200 bg-white pl-4 pr-2 py-1.5 text-left shadow-[-8px_0_14px_-14px_rgba(15,23,42,0.14)] md:static md:w-auto md:min-w-0 md:border-l-0 md:bg-transparent md:px-6 md:text-right md:shadow-none">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!saveId}
                                    onClick={() => setActiveExpiringContract(player)}
                                    className="h-9 w-[124px] justify-center gap-1.5 text-xs md:hidden"
                                  >
                                    <Handshake className="h-4 w-4" />
                                    Re-sign
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={!saveId}
                                    onClick={() => setActiveExpiringContract(player)}
                                    className="hidden md:inline-flex"
                                  >
                                    <Handshake className="h-4 w-4" />
                                    <span className="sr-only">Re-sign {player.name}</span>
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {filteredExpiringContracts.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
                          No players match the current filters.
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
              {expiringError ? (
                <div className="px-4 py-4 text-sm text-destructive sm:px-6">{expiringError}</div>
              ) : null}
            </div>
          ) : activeTab === 'tradeBlock' ? (
            <>
              <TradeBlockTable
                data={tradeBlockPlayers}
                loading={isTradeBlockLoading && tradeBlockPlayers.length === 0}
                onExplorePlayer={(player) =>
                  router.push(
                    `/manage/trades?partnerTeamAbbr=${player.teamAbbr ?? ''}&playerId=${player.id}`,
                  )
                }
              />
              {tradeBlockError ? (
                <div className="px-4 py-4 text-sm text-destructive sm:px-6">{tradeBlockError}</div>
              ) : null}
            </>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              <PlayerTable
                data={sortedPlayers}
                variant="roster"
                loading={isRosterLoading && players.length === 0}
                onCutPlayer={setActiveCutPlayer}
                onTradePlayer={(player) => router.push(`/manage/trades?playerId=${player.id}`)}
                onRenegotiatePlayer={setActiveRenegotiatePlayer}
              />
            </div>
          )}
        </div>
      ) : (
        <PlayerTable
          data={sortedPlayers}
          variant="roster"
          loading={isRosterLoading && players.length === 0}
          onCutPlayer={setActiveCutPlayer}
          onTradePlayer={(player) => router.push(`/manage/trades?playerId=${player.id}`)}
          onRenegotiatePlayer={setActiveRenegotiatePlayer}
        />
      )}
      {activeCutPlayer ? (
        <CutPlayerModal
          player={activeCutPlayer}
          isOpen={Boolean(activeCutPlayer)}
          currentCapSpace={capSpace}
          onClose={() => setActiveCutPlayer(null)}
          onSubmit={handleSubmitCut}
        />
      ) : null}
      {activeResignPlayer ? (
        <ResignPlayerModal
          player={activeResignPlayer}
          expectedApyOverride={activeResignPlayer.contract?.apy}
          teamAbbr={teamAbbr ?? undefined}
          teamRoster={players}
          previousTeamAbbr={teamAbbr ?? undefined}
          isOpen={Boolean(activeResignPlayer)}
          onClose={() => setActiveResignPlayer(null)}
          onSubmit={handleSubmitResign}
        />
      ) : null}
      {expiringResignPlayer && activeExpiringContract ? (
        <ResignPlayerModal
          player={expiringResignPlayer}
          expectedApyOverride={activeExpiringContract.estValue / 1_000_000}
          teamAbbr={teamAbbr ?? undefined}
          teamRoster={players}
          previousTeamAbbr={activeExpiringContract.lastTeamAbbr ?? null}
          isOpen={Boolean(activeExpiringContract)}
          onClose={() => setActiveExpiringContract(null)}
          onSubmit={handleSubmitResign}
        />
      ) : null}
      {activeRenegotiatePlayer ? (
        <RenegotiateModal
          player={activeRenegotiatePlayer}
          isOpen={Boolean(activeRenegotiatePlayer)}
          saveId={saveId || undefined}
          teamLogoUrl={selectedTeam?.logo_url ?? null}
          onClose={() => setActiveRenegotiatePlayer(null)}
          onSubmit={handleSubmitRenegotiate}
        />
      ) : null}
      <ResignOfferResultModal
        result={resignResult}
        isOpen={isResignResultOpen}
        onClose={() => setIsResignResultOpen(false)}
      />
      {isRenegotiateResultOpen && renegotiateResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Renegotiation
                </p>
                <h3 className="text-lg font-semibold text-foreground">
                  {renegotiateResult.accepted
                    ? `${renegotiateResultPlayer?.firstName ?? ''} ${
                        renegotiateResultPlayer?.lastName ?? ''
                      } accepted`
                    : 'Renegotiation declined'}
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsRenegotiateResultOpen(false)}
              >
                ✕
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedTeam?.name ?? teamAbbr ?? 'Team'} renegotiated with{' '}
              {renegotiateResultPlayer
                ? `${renegotiateResultPlayer.firstName} ${renegotiateResultPlayer.lastName}`
                : 'the player'}
              .
            </p>
            <div className="mt-4 rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm text-foreground">
              “
              {renegotiateResult.accepted
                ? `${renegotiateResult.quote} ${getTeamCatchphrase(teamAbbr)}`
                : renegotiateResult.quote}
              ”
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setIsRenegotiateResultOpen(false)}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <OnboardingModal
        open={isOnboardingOpen}
        teamName={selectedTeam?.name ?? 'your team'}
        primaryColor={onboardingPrimaryColor}
        primaryTextColor={onboardingPrimaryTextColor}
        currentStep={onboardingStep}
        totalSteps={onboardingTotalSteps}
        onContinue={advanceOnboarding}
        onSkip={skipOnboarding}
        onPrevious={retreatOnboarding}
      />
    </AppShell>
  );
}
