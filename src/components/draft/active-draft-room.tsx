'use client';

import * as React from 'react';

import { FalcoReactionFeed, type DraftEventDTO } from '@/components/draft/falco-reaction-feed';
import { DraftTeamCard } from '@/components/draft/draft-team-card';
import { DraftTradeChaosPanel } from '@/components/draft/draft-trade-chaos-panel';
import { DraftTradeOfferReviewModal } from '@/components/draft/draft-trade-offer-review-modal';
import { LiveDraftBoard } from '@/components/draft/live-draft-board';
import { OnTheClockBanner } from '@/components/draft/on-the-clock-banner';
import { PlayerTable } from '@/components/player-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import {
  fillFalcoTemplate,
  type FalcoAlertType,
  quotesByType,
} from '@/features/draft/falco-quotes';
import { useSaveStore } from '@/features/save/save-store';
import { getDraftAutopick, rankDraftBoard } from '@/lib/draft-board';
import { getFalcoReaction, getPickLabel } from '@/lib/draft-reactions';
import { useDraftClock } from '@/hooks/use-draft-clock';
import { getTeamNeeds } from '@/components/draft/draft-utils';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';
import type { FalcoNote } from '@/lib/falco';
import type { TradeOfferDTO } from '@/types/trade-offers';

const SPEED_DELAYS = [4000, 2500, 1500] as const;
const USER_PICK_DURATION_SECONDS = 90;

export type DraftSpeedLevel = 0 | 1 | 2;

type ActiveDraftRoomProps = {
  session: DraftSessionDTO;
  draftSessionId: string;
  teams: TeamDTO[];
  falcoNotes: FalcoNote[];
  speedLevel: DraftSpeedLevel;
  draftView: 'board' | 'trade';
  isUserDraftModalOpen?: boolean;
  draftPhase?: 'PRE_DRAFT' | 'IN_DRAFT' | 'COMPLETED';
  onBackToBoard: () => void;
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

export function ActiveDraftRoom({
  session,
  draftSessionId,
  teams,
  falcoNotes,
  speedLevel,
  draftView,
  isUserDraftModalOpen = false,
  draftPhase = 'IN_DRAFT',
  onBackToBoard,
  onDraftPlayer,
  onDraftTradeAccepted,
  onSessionUpdate,
}: ActiveDraftRoomProps) {
  const saveId = useSaveStore((state) => state.saveId);
  const currentPick = session.picks[session.currentPickIndex];
  const onClock =
    currentPick?.ownerTeamAbbr === session.userTeamAbbr && !currentPick?.selectedPlayerId;
  const [draftFeed, setDraftFeed] = React.useState<DraftEventDTO[]>([]);
  const [draftOffers, setDraftOffers] = React.useState<Array<TradeOfferDTO & { expiresAt: number }>>(
    [],
  );
  const [reviewOffer, setReviewOffer] = React.useState<TradeOfferDTO | null>(null);
  const [selectedBoardPlayerId, setSelectedBoardPlayerId] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
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
  const offersSectionRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    if (draftView !== 'trade') return;
    offersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onBackToBoard();
  }, [draftView, onBackToBoard]);

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

  const falcoFavorites = React.useMemo(() => {
    if (!onClock || !currentPick) {
      return [];
    }
    return bestAvailable
      .map((player) => {
        const rank = player.rank ?? 999;
        const tags = falcoTagsByPlayer.get(player.id) ?? [];
        let score = 200 - rank;
        score += Math.max(0, currentPick.overall - rank) * 2;
        if (teamNeeds.includes(player.position)) score += 25;
        if (tags.includes('Falco Favorite')) score += 20;
        if (tags.includes('Falco Rising')) score += 10;
        if (tags.includes('Falco Fading')) score -= 8;
        return { player, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.player);
  }, [bestAvailable, currentPick, falcoTagsByPlayer, onClock, teamNeeds]);

  const advanceCpuPick = React.useCallback(async () => {
    if (advanceInFlight.current || skipInFlight.current) {
      return;
    }
    advanceInFlight.current = true;
    try {
      const response = await apiFetch('/api/draft/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftSessionId }),
      });
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
  }, [draftSessionId, onSessionUpdate]);

  const handleSkipToUserPick = React.useCallback(async () => {
    if (onClock || skipInFlight.current) {
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
        const response = await apiFetch('/api/draft/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftSessionId }),
        });
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
  }, [draftSessionId, onClock, onSessionUpdate, session]);

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
    const drafted = session.picks
      .filter((pick) => pick.selectedPlayerId)
      .slice(-5)
      .map((pick) => session.prospects.find((player) => player.id === pick.selectedPlayerId))
      .filter(Boolean);
    if (drafted.length < 3) return;
    const counts = drafted.reduce<Record<string, number>>((acc, player) => {
      const pos = player?.position ?? 'UNK';
      acc[pos] = (acc[pos] ?? 0) + 1;
      return acc;
    }, {});
    const runEntry = Object.entries(counts).find(([, count]) => count >= 3);
    if (!runEntry) return;
    const [position] = runEntry;
    if (lastRunRef.current === position) return;
    lastRunRef.current = position;
    const message = buildAlertMessage('POSITION_RUN', { POSITION: position });
    pushAlert({
      id: `run-${position}-${session.currentPickIndex}`,
      type: 'POSITION_RUN',
      message,
      createdAt: new Date().toISOString(),
    });
  }, [buildAlertMessage, pushAlert, session.currentPickIndex, session.picks, session.prospects]);

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
      const response = await apiFetch('/api/trade-offers/next', {
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
      });

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

  return (
    <>
      <div className="space-y-5">
        {currentPick ? (
          <OnTheClockBanner
            teamName={selectedTeam?.name ?? currentPick.ownerTeamAbbr}
            teamLogoUrl={selectedTeam?.logoUrl}
            teamAbbr={currentPick.ownerTeamAbbr}
            round={currentPick.round}
            overall={currentPick.overall}
            isUserOnClock={onClock}
            secondsRemaining={onClock ? secondsRemaining : null}
            progressPct={onClock ? progressPct : 100}
            isCritical={isCritical}
            activeTradeOfferCount={onClock ? draftOffers.length : 0}
          />
        ) : null}

        {onClock && falcoFavorites.length > 0 ? (
          <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Falco Favorites
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {falcoFavorites.map((player) => (
                <div key={player.id} className="rounded-xl border border-border bg-slate-50 px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">{formatName(player)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {player.position} · Rank {player.rank ?? '--'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div ref={offersSectionRef}>
          <DraftTradeChaosPanel
            offers={draftOffers}
            now={now}
            onReview={(offer) => setReviewOffer(offer)}
            onDecline={(offerId) => setDraftOffers((current) => current.filter((offer) => offer.id !== offerId))}
            onDismiss={(offerId) => setDraftOffers((current) => current.filter((offer) => offer.id !== offerId))}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Draft Order
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Round 1 Tracker</h2>
                </div>
                {!onClock ? (
                  <Button type="button" variant="secondary" size="sm" onClick={handleSkipToUserPick}>
                    Skip To My Pick
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 max-h-[42rem] space-y-3 overflow-y-auto pr-1">
                {session.picks.map((pick, index) => {
                  const isCurrent = index === session.currentPickIndex;
                  const isNext = index === session.currentPickIndex + 1;
                  const selectedPlayer = pick.selectedPlayerId
                    ? session.prospects.find((player) => player.id === pick.selectedPlayerId)
                    : null;
                  const team = teamLookup.get(pick.ownerTeamAbbr);
                  const statusLine = selectedPlayer
                    ? `${pick.ownerTeamAbbr} drafted ${formatName(selectedPlayer)} (${selectedPlayer.position})`
                    : isCurrent
                      ? 'On the clock'
                      : isNext
                        ? 'On deck'
                        : 'Waiting';
                  return (
                    <div key={pick.id} className="relative">
                      <DraftTeamCard
                        variant={draftPhase === 'PRE_DRAFT' ? 'pre' : 'in'}
                        model={{
                          pickNumber: pick.overall,
                          teamName: team?.name ?? pick.ownerTeamAbbr,
                          logoUrl: team?.logoUrl,
                          statusLine,
                          isOnClock: isCurrent,
                        }}
                      />
                      {pick.ownerTeamAbbr === session.userTeamAbbr ? (
                        <Badge variant="secondary" className="pointer-events-none absolute right-2 top-2">
                          User
                        </Badge>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <FalcoReactionFeed events={draftFeed} />
          </section>

          <section className="min-w-0 space-y-5">
            <LiveDraftBoard
              entries={boardEntries}
              selectedPlayerId={selectedBoardPlayerId}
              onSelectPlayer={setSelectedBoardPlayerId}
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

            {spotlightPlayer ? (
              <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Player Spotlight
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">
                      {spotlightPlayer.firstName} {spotlightPlayer.lastName}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {spotlightPlayer.position} · {spotlightPlayer.college ?? 'College TBD'} · OVR{' '}
                      {spotlightPlayer.rating ?? spotlightPlayer.maddenRating ?? '--'}
                    </p>
                  </div>
                  {onClock && onDraftPlayer ? (
                    <Button type="button" onClick={() => void onDraftPlayer(spotlightPlayer)}>
                      Draft {spotlightPlayer.firstName}
                    </Button>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Full Prospect Pool
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Available Players</h2>
                </div>
                {!onClock && bestAvailable.length > 0 ? (
                  <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                    CPU teams are picking. Your board stays live.
                  </div>
                ) : null}
              </div>
              <div className="mt-4">
                <PlayerTable
                  data={bestAvailable}
                  variant="draft"
                  onDraftPlayer={onClock ? onDraftPlayer : undefined}
                  onTheClockForUserTeam={onClock}
                />
              </div>
            </section>
          </section>
        </div>
      </div>

      <DraftTradeOfferReviewModal
        open={Boolean(reviewOffer)}
        offer={reviewOffer}
        draftSessionId={draftSessionId}
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
