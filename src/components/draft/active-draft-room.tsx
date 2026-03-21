'use client';

import * as React from 'react';

import { FalcoReactionFeed, type DraftEventDTO } from '@/components/draft/falco-reaction-feed';
import { DraftTrackerRibbon } from '@/components/draft/draft-tracker-ribbon';
import { DraftTradeOfferReviewModal } from '@/components/draft/draft-trade-offer-review-modal';
import { LiveDraftBoard } from '@/components/draft/live-draft-board';
import { OnTheClockBanner } from '@/components/draft/on-the-clock-banner';
import { ProspectDetailsModal } from '@/components/draft/prospect-details-modal';
import { WarRoomPanel } from '@/components/draft/war-room-panel';
import { Button } from '@/components/ui/button';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import {
  fillFalcoTemplate,
  type FalcoAlertType,
  quotesByType,
} from '@/features/draft/falco-quotes';
import { getDraftAutopick, rankDraftBoard } from '@/lib/draft-board';
import {
  detectActiveDraftRuns,
  evaluateDraftPick,
  summarizeDraftClass,
} from '@/lib/draft-intelligence';
import { OFFSEASON_PROGRESS_POINTS } from '@/lib/offseason-progress';
import { getFalcoReaction, getPickLabel } from '@/lib/draft-reactions';
import { useDraftClock } from '@/hooks/use-draft-clock';
import { getTeamNeeds } from '@/components/draft/draft-utils';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveUnlocksDTO } from '@/types/save';
import type { TeamDTO } from '@/types/team';
import type { FalcoNote } from '@/lib/falco';
import type { TradeOfferDTO } from '@/types/trade-offers';

const SPEED_DELAYS = [4000, 2500, 1500] as const;
const USER_PICK_DURATION_SECONDS = 90;

export type DraftSpeedLevel = 0 | 1 | 2;

type ActiveDraftRoomProps = {
  saveId: string;
  session: DraftSessionDTO;
  draftSessionId: string;
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
  falcoNotes: FalcoNote[];
  speedLevel: DraftSpeedLevel;
  showSettings: boolean;
  draftView: 'board' | 'trade';
  isUserDraftModalOpen?: boolean;
  isControlsBusy?: boolean;
  onBackToBoard: () => void;
  onSpeedChange: (value: DraftSpeedLevel) => void;
  onTogglePause: () => void;
  onStartDraft: () => void;
  onOfferTrade: () => void;
  onToggleSettings: () => void;
  onDraftPlayer?: (player: PlayerRowDTO) => void;
  onDraftTradeAccepted: (payload: {
    nextSession: DraftSessionDTO;
    nextRoster: PlayerRowDTO[];
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
  onSessionUpdate: (session: DraftSessionDTO) => void;
};

type TradeOfferApiResponse =
  | {
      ok: true;
      offers: TradeOfferDTO[];
    }
  | { ok: false; error: string };

const formatName = (player: PlayerRowDTO) => `${player.firstName} ${player.lastName}`;

const desiredOfferCount = (pickOverall: number) => {
  if (pickOverall <= 10) return 3;
  if (pickOverall <= 24) return 2;
  return 1;
};

const buildExpiryMs = (pickOverall: number, index: number) => {
  const base = pickOverall <= 10 ? 28000 : pickOverall <= 24 ? 22000 : 18000;
  return base - index * 2500;
};

const buildManualDraftTradeOffer = ({
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

export function ActiveDraftRoom({
  saveId,
  session,
  draftSessionId,
  saveSnapshot,
  teams,
  falcoNotes,
  speedLevel,
  showSettings,
  draftView,
  isUserDraftModalOpen = false,
  isControlsBusy = false,
  onBackToBoard,
  onSpeedChange,
  onTogglePause,
  onStartDraft,
  onOfferTrade,
  onToggleSettings,
  onDraftPlayer,
  onDraftTradeAccepted,
  onSessionUpdate,
}: ActiveDraftRoomProps) {
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);
  const { push: pushToast } = useToast();
  const currentPick = session.picks[session.currentPickIndex];
  const onClock =
    currentPick?.ownerTeamAbbr === session.userTeamAbbr && !currentPick?.selectedPlayerId;
  const [draftFeed, setDraftFeed] = React.useState<DraftEventDTO[]>([]);
  const [draftOffers, setDraftOffers] = React.useState<Array<TradeOfferDTO & { expiresAt: number }>>(
    [],
  );
  const [reviewOffer, setReviewOffer] = React.useState<TradeOfferDTO | null>(null);
  const [selectedBoardPlayerId, setSelectedBoardPlayerId] = React.useState<string | null>(null);
  const [isProspectModalOpen, setIsProspectModalOpen] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const userTeam = React.useMemo(
    () => teams.find((team) => team.abbr === session.userTeamAbbr) ?? null,
    [session.userTeamAbbr, teams],
  );
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);
  const advanceInFlight = React.useRef(false);
  const skipInFlight = React.useRef(false);
  const timerRef = React.useRef<number | null>(null);
  const pickInProgressRef = React.useRef(false);
  const sessionRef = React.useRef(session);
  const previousPickSelections = React.useRef<Map<string, string | null>>(new Map());
  const firedFreeFallRef = React.useRef(false);
  const lastRunRef = React.useRef<string | null>(null);
  const offersRequestRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    if (draftView === 'trade') {
      const nextPartnerTeamAbbr =
        session.picks
          .slice(session.currentPickIndex + 1)
          .find(
            (pick) =>
              !pick.selectedPlayerId && pick.ownerTeamAbbr !== session.userTeamAbbr,
          )?.ownerTeamAbbr ?? teams.find((team) => team.abbr !== session.userTeamAbbr)?.abbr;
      const partnerTeam = teams.find((team) => team.abbr === nextPartnerTeamAbbr) ?? null;

      setReviewOffer((current) => {
        if (current) return current;
        if (partnerTeam) {
          return buildManualDraftTradeOffer({ partnerTeam, userTeam });
        }
        return draftOffers[0] ?? null;
      });
      onBackToBoard();
    }
  }, [
    draftOffers,
    draftView,
    onBackToBoard,
    session.currentPickIndex,
    session.picks,
    session.userTeamAbbr,
    teams,
    userTeam,
  ]);

  React.useEffect(() => {
    firedFreeFallRef.current = false;
    lastRunRef.current = null;
    offersRequestRef.current = null;
  }, [session.id]);

  React.useEffect(() => {
    setDraftOffers((current) =>
      current.filter((offer) => offer.expiresAt > Date.now() && offer.trigger === `pick-${currentPick?.overall ?? 0}`),
    );
  }, [currentPick?.id, currentPick?.overall]);

  const bestAvailable = React.useMemo(() => {
    return session.prospects
      .filter((player) => !player.isDrafted)
      .slice()
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }, [session.prospects]);

  const teamLookup = React.useMemo(() => {
    const map = new Map(teams.map((team) => [team.abbr, team]));
    return map;
  }, [teams]);

  const teamNeeds = React.useMemo(
    () => getTeamNeeds(session.userTeamAbbr, teams),
    [session.userTeamAbbr, teams],
  );
  const activeRuns = React.useMemo(
    () => detectActiveDraftRuns(session.picks, session.prospects),
    [session.picks, session.prospects],
  );

  const boardEntries = React.useMemo(
    () =>
      rankDraftBoard({
        prospects: session.prospects,
        teamNeeds,
        currentPickOverall: currentPick?.overall ?? session.currentPickIndex + 1,
        limit: 12,
      }),
    [currentPick?.overall, session.currentPickIndex, session.prospects, teamNeeds],
  );
  const topRankedEntries = React.useMemo(
    () =>
      boardEntries
        .slice()
        .sort((left, right) => {
          const leftRank = left.player.rank ?? Number.MAX_SAFE_INTEGER;
          const rightRank = right.player.rank ?? Number.MAX_SAFE_INTEGER;
          if (leftRank !== rightRank) return leftRank - rightRank;
          return (
            (right.player.rating ?? right.player.maddenRating ?? 0) -
            (left.player.rating ?? left.player.maddenRating ?? 0)
          );
        }),
    [boardEntries],
  );

  const userDraftSummary = React.useMemo(() => {
    const userPicks = session.picks
      .filter((pick) => pick.selectedByTeamAbbr === session.userTeamAbbr && pick.selectedPlayerId)
      .map((pick) => {
        const player = session.prospects.find((prospect) => prospect.id === pick.selectedPlayerId);
        return player ? { pick, player } : null;
      })
      .filter((entry): entry is { pick: DraftSessionDTO['picks'][number]; player: PlayerRowDTO } =>
        Boolean(entry),
      );

    const evaluations = userPicks.map(({ pick, player }) =>
      evaluateDraftPick({
        player,
        currentPickOverall: pick.overall,
        teamNeeds,
      }),
    );

    return summarizeDraftClass({
      picks: userPicks,
      evaluations,
      teamNeeds,
    });
  }, [session.picks, session.prospects, session.userTeamAbbr, teamNeeds]);

  const spotlightPlayer = React.useMemo(() => {
    if (!selectedBoardPlayerId) {
      return boardEntries[0]?.player ?? null;
    }
    return (
      boardEntries.find((entry) => entry.player.id === selectedBoardPlayerId)?.player ??
      bestAvailable.find((player) => player.id === selectedBoardPlayerId) ??
      boardEntries[0]?.player ??
      null
    );
  }, [bestAvailable, boardEntries, selectedBoardPlayerId]);

  React.useEffect(() => {
    if (!selectedBoardPlayerId && boardEntries[0]) {
      setSelectedBoardPlayerId(boardEntries[0].player.id);
      return;
    }
    if (selectedBoardPlayerId && !bestAvailable.some((player) => player.id === selectedBoardPlayerId)) {
      setSelectedBoardPlayerId(boardEntries[0]?.player.id ?? null);
    }
  }, [bestAvailable, boardEntries, selectedBoardPlayerId]);

  const buildAlertMessage = React.useCallback(
    (type: FalcoAlertType, data: Record<string, string | number | undefined>) => {
      const options = quotesByType[type];
      const choice = options[Math.floor(Math.random() * options.length)] ?? options[0];
      return fillFalcoTemplate(choice, data);
    },
    [],
  );

  const falcoTagsByPlayer = React.useMemo(() => {
    const map = new Map<string, string[]>();
    falcoNotes.forEach((note) => {
      const list = map.get(note.playerId) ?? [];
      list.push(note.tag);
      map.set(note.playerId, list);
    });
    return map;
  }, [falcoNotes]);

  const advanceCpuPick = React.useCallback(async () => {
    if (advanceInFlight.current || skipInFlight.current || !saveId) {
      return;
    }
    advanceInFlight.current = true;
    try {
      const response = await apiFetch(
        '/api/draft/session/advance',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftSessionId,
            saveId,
            sessionSnapshot: sessionRef.current,
            saveSnapshot,
          }),
        },
        { skipSaveGuard: true },
      );
      const text = await response.text();
      if (!text) {
        return;
      }
      const payload = JSON.parse(text) as
        | { ok: true; session: DraftSessionDTO }
        | { ok: false; error: string };
      if (!response.ok || !payload.ok) {
        return;
      }
      onSessionUpdate(payload.session);
    } finally {
      advanceInFlight.current = false;
    }
  }, [draftSessionId, onSessionUpdate, saveId, saveSnapshot]);

  const handleSkipToUserPick = React.useCallback(async () => {
    if (onClock || skipInFlight.current || !saveId) {
      return;
    }
    skipInFlight.current = true;
    try {
      let safety = 0;
      let snapshot = session;
      while (safety < 64) {
        const current = snapshot.picks[snapshot.currentPickIndex];
        if (!current || current.ownerTeamAbbr === snapshot.userTeamAbbr) {
          onSessionUpdate(snapshot);
          break;
        }
        const response = await apiFetch(
          '/api/draft/session/advance',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              draftSessionId,
              saveId,
              sessionSnapshot: snapshot,
              saveSnapshot,
            }),
          },
          { skipSaveGuard: true },
        );
        const text = await response.text();
        if (!text) break;
        const payload = JSON.parse(text) as
          | { ok: true; session: DraftSessionDTO }
          | { ok: false; error: string };
        if (!response.ok || !payload.ok) break;
        snapshot = payload.session;
        onSessionUpdate(snapshot);
        safety += 1;
      }
    } finally {
      skipInFlight.current = false;
    }
  }, [draftSessionId, onClock, onSessionUpdate, saveId, saveSnapshot, session]);

  const clearDraftTimer = React.useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNextCpuPick = React.useCallback(() => {
    clearDraftTimer();
    const delay = SPEED_DELAYS[speedLevel] ?? 2500;
    timerRef.current = window.setTimeout(async () => {
      const currentSession = sessionRef.current;
      const current = currentSession.picks[currentSession.currentPickIndex];
      const userOnClock =
        current?.ownerTeamAbbr === currentSession.userTeamAbbr && !current?.selectedPlayerId;
      if (
        currentSession.status !== 'in_progress' ||
        currentSession.isPaused ||
        userOnClock ||
        isUserDraftModalOpen
      ) {
        return;
      }
      if (pickInProgressRef.current) {
        scheduleNextCpuPick();
        return;
      }
      pickInProgressRef.current = true;
      await advanceCpuPick();
      pickInProgressRef.current = false;
      scheduleNextCpuPick();
    }, delay);
  }, [advanceCpuPick, clearDraftTimer, isUserDraftModalOpen, speedLevel]);

  React.useEffect(() => {
    const current = session.picks[session.currentPickIndex];
    const userOnClock =
      current?.ownerTeamAbbr === session.userTeamAbbr && !current?.selectedPlayerId;
    if (
      session.status !== 'in_progress' ||
      session.isPaused ||
      userOnClock ||
      isUserDraftModalOpen
    ) {
      clearDraftTimer();
      return;
    }
    scheduleNextCpuPick();
    return () => clearDraftTimer();
  }, [
    clearDraftTimer,
    isUserDraftModalOpen,
    scheduleNextCpuPick,
    session.currentPickIndex,
    session.isPaused,
    session.picks,
    session.status,
    session.userTeamAbbr,
  ]);

  const autoPickInFlightRef = React.useRef(false);
  const draftBestAvailable = boardEntries[0]?.player ?? null;
  const { secondsRemaining, isCritical, progressPct } = useDraftClock({
    clockKey: onClock && currentPick ? `${session.id}:${currentPick.id}` : null,
    enabled: onClock && session.status === 'in_progress' && !session.isPaused && !isUserDraftModalOpen,
    durationSeconds: USER_PICK_DURATION_SECONDS,
    onExpire: async () => {
      if (autoPickInFlightRef.current || !onClock || !onDraftPlayer || !currentPick) {
        return;
      }
      const autopick =
        getDraftAutopick({
          prospects: sessionRef.current.prospects,
          teamNeeds: getTeamNeeds(sessionRef.current.userTeamAbbr, teams),
          currentPickOverall: currentPick.overall,
        }) ?? draftBestAvailable;
      if (!autopick) {
        return;
      }
      autoPickInFlightRef.current = true;
      await onDraftPlayer(autopick);
      autoPickInFlightRef.current = false;
    },
  });

  React.useEffect(() => {
    const newEvents: DraftEventDTO[] = [];
    session.picks.forEach((pick) => {
      const previous = previousPickSelections.current.get(pick.id) ?? null;
      if (pick.selectedPlayerId && pick.selectedPlayerId !== previous) {
        const player = session.prospects.find((prospect) => prospect.id === pick.selectedPlayerId);
        if (!player) {
          return;
        }
        const tags = (falcoTagsByPlayer.get(player.id) ?? []) as FalcoNote['tag'][];
        const label = getPickLabel({
          pickIndex: pick.overall,
          playerRank: player.rank ?? 999,
          teamNeeds: getTeamNeeds(pick.ownerTeamAbbr, teams),
          playerPosition: player.position,
          tags,
        });
        newEvents.push({
          id: `event-${pick.id}-${pick.selectedPlayerId}`,
          playerId: player.id,
          pickNumber: pick.overall,
          teamAbbr: pick.ownerTeamAbbr,
          teamLogoUrl: teamLookup.get(pick.ownerTeamAbbr)?.logoUrl,
          playerName: formatName(player),
          position: player.position,
          label,
          reaction: getFalcoReaction({
            label,
            teamAbbr: pick.ownerTeamAbbr,
            playerName: formatName(player),
            position: player.position,
            pickNumber: pick.overall,
          }),
          createdAt: new Date().toISOString(),
        });
      }
      previousPickSelections.current.set(pick.id, pick.selectedPlayerId ?? null);
    });
    if (newEvents.length > 0) {
      setDraftFeed((prev) => [...newEvents.reverse(), ...prev].slice(0, 50));
      newEvents.forEach((event) => {
        const player = session.prospects.find((prospect) => prospect.id === event.playerId);
        if (!player) return;
        const projected = player.projectedPick ?? player.rank ?? event.pickNumber;
        const delta = event.pickNumber - projected;
        if (delta <= -10) {
          const message = buildAlertMessage('RISKY_REACH', {
            PLAYER: event.playerName,
            TEAM: event.teamAbbr,
            PICK: event.pickNumber,
            PROJECTED: projected,
          });
          pushAlert({
            id: `reach-${event.playerId}`,
            type: 'RISKY_REACH',
            message,
            createdAt: new Date().toISOString(),
          });
        }
        if (event.teamAbbr === session.userTeamAbbr && delta >= 10) {
          const message = buildAlertMessage('VALUE_STEAL', {
            PLAYER: event.playerName,
            PICK: event.pickNumber,
            PROJECTED: projected,
          });
          pushAlert({
            id: `value-${event.playerId}`,
            type: 'VALUE_STEAL',
            message,
            createdAt: new Date().toISOString(),
          });
        }
      });
    }
  }, [
    buildAlertMessage,
    falcoTagsByPlayer,
    pushAlert,
    session.picks,
    session.prospects,
    session.userTeamAbbr,
    teamLookup,
    teams,
  ]);

  React.useEffect(() => {
    const fallingId = session.fallingProspectId;
    if (!fallingId || firedFreeFallRef.current) return;
    const player = session.prospects.find((prospect) => prospect.id === fallingId);
    if (!player || player.isDrafted) return;
    const projected = player.projectedPick ?? player.rank ?? 0;
    if (session.currentPickIndex + 1 >= projected + 10) {
      firedFreeFallRef.current = true;
      pushAlert({
        id: `freefall-${player.id}`,
        type: 'FREE_FALL',
        title: `${player.firstName} ${player.lastName}`,
        message: "He's slipping.",
        lines: ["He's slipping.", "Something's spooked teams. Could be noise. Could be real.", 'Trust your read.'],
        createdAt: new Date().toISOString(),
      });
    }
  }, [pushAlert, session.currentPickIndex, session.fallingProspectId, session.prospects]);

  React.useEffect(() => {
    if (activeRuns.length === 0) return;
    const currentRun = activeRuns[0];
    if (lastRunRef.current === currentRun.position) return;
    lastRunRef.current = currentRun.position;
    const message = buildAlertMessage('POSITION_RUN', { POSITION: currentRun.position });
    pushAlert({
      id: `run-${currentRun.position}-${session.currentPickIndex}`,
      type: 'POSITION_RUN',
      message,
      createdAt: new Date().toISOString(),
    });
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches) {
      pushToast({
        id: `decision-note:${session.id}:${currentRun.position}:${session.currentPickIndex}`,
        variant: 'info',
        title: 'Decision Note',
        description: `${currentRun.headline} ${currentRun.count} ${currentRun.position} prospects have gone in the last ${currentRun.window} picks.`,
        durationMs: 4200,
      });
    }
  }, [activeRuns, buildAlertMessage, pushAlert, pushToast, session.currentPickIndex, session.id]);

  React.useEffect(() => {
    if (!saveId || !onClock || !currentPick || isUserDraftModalOpen) {
      return;
    }

    const requestKey = `${session.id}:${currentPick.id}`;
    if (offersRequestRef.current === requestKey) {
      return;
    }
    offersRequestRef.current = requestKey;

    const loadOffers = async () => {
      const response = await apiFetch(
        '/api/trade-offers/next',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saveId,
            userTeamAbbr: session.userTeamAbbr,
            phase: 'draft',
            trigger: `pick-${currentPick.overall}`,
            draftSessionId,
            draftCurrentPickIndex: session.currentPickIndex,
          }),
        },
        { skipSaveGuard: true },
      );

      if (!response.ok) {
        setDraftOffers([]);
        return;
      }

      const data = (await response.json()) as TradeOfferApiResponse;
      if (!data.ok) {
        setDraftOffers([]);
        return;
      }

      const limited = data.offers.slice(0, desiredOfferCount(currentPick.overall));
      const createdAt = Date.now();
      setDraftOffers(
        limited.map((offer, index) => ({
          ...offer,
          expiresAt: createdAt + buildExpiryMs(currentPick.overall, index),
        })),
      );
    };

    void loadOffers();
  }, [
    currentPick,
    draftSessionId,
    isUserDraftModalOpen,
    onClock,
    saveId,
    session.currentPickIndex,
    session.id,
    session.userTeamAbbr,
  ]);

  React.useEffect(() => {
    setDraftOffers((current) => current.filter((offer) => offer.expiresAt > now));
  }, [now]);

  const selectedTeam = currentPick ? teamLookup.get(currentPick.ownerTeamAbbr) : null;
  const inspectedPlayer =
    (selectedBoardPlayerId
      ? bestAvailable.find((player) => player.id === selectedBoardPlayerId)
      : null) ?? spotlightPlayer;

  return (
    <>
      <div className="space-y-5">
        {currentPick ? (
          <OnTheClockBanner
            teamName={selectedTeam?.name ?? currentPick.ownerTeamAbbr}
            teamLogoUrl={selectedTeam?.logoUrl}
            teamAbbr={currentPick.ownerTeamAbbr}
            teamPrimaryColor={selectedTeam?.colors?.[0] ?? null}
            round={currentPick.round}
            overall={currentPick.overall}
            isUserOnClock={onClock}
            secondsRemaining={onClock ? secondsRemaining : null}
            progressPct={onClock ? progressPct : 100}
            isCritical={isCritical}
            activeTradeOfferCount={onClock ? draftOffers.length : 0}
          />
        ) : null}

        <DraftTrackerRibbon
          picks={session.picks}
          currentPickIndex={session.currentPickIndex}
          prospects={session.prospects}
          teams={teams}
          userTeamAbbr={session.userTeamAbbr}
          controls={{
            speedLevel,
            showSettings,
            hasStarted: true,
            isPaused: session.isPaused,
            isBusy: isControlsBusy,
            canOfferTrade: onClock,
            canSkipToUserPick: !onClock,
            onSpeedChange,
            onTogglePause,
            onStartDraft,
            onOfferTrade,
            onSkipToUserPick: handleSkipToUserPick,
            onToggleSettings,
          }}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-5">
            <LiveDraftBoard
              entries={rankDraftBoard({
                prospects: session.prospects,
                teamNeeds,
                currentPickOverall: currentPick?.overall ?? session.currentPickIndex + 1,
                limit: bestAvailable.length,
              })}
              teamNeeds={teamNeeds}
              activeRuns={activeRuns}
              onInspectPlayer={(playerId) => {
                setSelectedBoardPlayerId(playerId);
                setIsProspectModalOpen(true);
              }}
              onDraftPlayer={
                onClock && onDraftPlayer
                  ? (playerId) => {
                      const player = session.prospects.find((entry) => entry.id === playerId);
                      if (player) {
                        void onDraftPlayer(player);
                      }
                    }
                  : undefined
              }
              canDraft={Boolean(onClock && onDraftPlayer)}
            />

            <FalcoReactionFeed events={draftFeed} />
          </section>

          <WarRoomPanel
            session={session}
            userTeamName={teamLookup.get(session.userTeamAbbr)?.name ?? session.userTeamAbbr}
            teamNeeds={teamNeeds}
            bestAvailableEntries={topRankedEntries.slice(0, 4)}
            activeRuns={activeRuns}
            summary={userDraftSummary}
            offers={draftOffers}
            now={now}
            onReviewOffer={(offer) => setReviewOffer(offer)}
            onDeclineOffer={(offerId) => {
              setDraftOffers((current) => current.filter((offer) => offer.id !== offerId));
              if (saveId) {
                const result = recordProgressEvent({
                  saveId,
                  step: 'draft',
                  eventKey: `draft-trade-declined:${offerId}`,
                  points: OFFSEASON_PROGRESS_POINTS.draft.trade_response,
                });
                if (result.changed) {
                  pushToast({
                    id: `progress:${saveId}:draft-trade-declined:${offerId}`,
                    kind: 'progress',
                    durationMs: 3200,
                    progress: {
                      message: 'Reviewed a draft trade offer and stayed disciplined.',
                      detail: 'Draft',
                    },
                  });
                }
              }
            }}
            onDismissOffer={(offerId) =>
              setDraftOffers((current) => current.filter((offer) => offer.id !== offerId))
            }
            onInspectPlayer={(playerId) => {
              setSelectedBoardPlayerId(playerId);
              setIsProspectModalOpen(true);
            }}
          />
        </div>
      </div>

      <ProspectDetailsModal
        open={isProspectModalOpen}
        player={inspectedPlayer}
        boardEntry={boardEntries.find((entry) => entry.player.id === inspectedPlayer?.id) ?? null}
        teamNeeds={teamNeeds}
        activeRuns={activeRuns}
        canDraft={Boolean(onClock && onDraftPlayer)}
        onDraft={
          onClock && onDraftPlayer
            ? (player) => {
                void onDraftPlayer(player);
                setIsProspectModalOpen(false);
              }
            : undefined
        }
        onClose={() => setIsProspectModalOpen(false)}
      />

      <DraftTradeOfferReviewModal
        open={Boolean(reviewOffer)}
        offer={reviewOffer}
        saveId={saveId}
        draftSessionId={draftSessionId}
        sessionSnapshot={session}
        saveSnapshot={saveSnapshot}
        teams={teams}
        onClose={() => setReviewOffer(null)}
        onAccepted={({ session: nextSession, roster: nextRoster, header }) => {
          onDraftTradeAccepted({
            nextSession,
            nextRoster,
            header,
          });
          setDraftOffers([]);
          setReviewOffer(null);
          offersRequestRef.current = null;
        }}
      />
    </>
  );
}
