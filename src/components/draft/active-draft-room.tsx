'use client';

import * as React from 'react';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';

import { type DraftEventDTO } from '@/components/draft/falco-reaction-feed';
import { MockTradeHub } from '@/components/draft/mock-trade-hub';
import { DraftSimulatorProspectTable } from '@/components/draft/draft-simulator-prospect-table';
import { ProspectDetailsModal } from '@/components/draft/prospect-details-modal';
import { Button } from '@/components/ui/button';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import {
  fillFalcoTemplate,
  type FalcoAlertType,
  quotesByType,
} from '@/features/draft/falco-quotes';
import { rankDraftBoard } from '@/lib/draft-board';
import { detectActiveDraftRuns } from '@/lib/draft-intelligence';
import { getFalcoReaction, getPickLabel } from '@/lib/draft-reactions';
import {
  reachedDraftSimulationTarget,
  type DraftSimulationTarget,
} from '@/lib/draft-simulation-target';
import { useDraftClock } from '@/hooks/use-draft-clock';
import { getTeamNeeds } from '@/components/draft/draft-utils';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { generateRoundTransitionBuzzToast } from '@/lib/league-buzz';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO, SaveUnlocksDTO } from '@/types/save';
import type { TeamDTO } from '@/types/team';
import type { FalcoNote } from '@/lib/falco';
import { LiveDraftPanels } from '@/components/draft/live-draft-panels';
import styles from '@/app/draft/room/mock-draft-room.module.css';

const SPEED_RATES = [1, 6, 450] as const;
const USER_PICK_DURATION_SECONDS = 90;

export type DraftSpeedLevel = 0 | 1 | 2;

type ActiveDraftRoomProps = {
  saveId: string;
  year: number;
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
  simulationTarget?: DraftSimulationTarget | null;
  onSimulationTargetReached?: () => void;
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
    header: Omit<SaveHeaderDTO, 'id'> & { saveId: string };
  }) => void;
  onSessionUpdate: (session: DraftSessionDTO) => void;
  onTradeUpdate: (session: DraftSessionDTO) => void;
  onTradeBusyChange: (busy: boolean) => void;
  onClockDisplayChange?: (clock: { pickId: string; text: string }) => void;
};

const formatName = (player: PlayerRowDTO) => `${player.firstName} ${player.lastName}`;

export function ActiveDraftRoom({
  saveId,
  year,
  session,
  draftSessionId,
  saveSnapshot,
  teams,
  falcoNotes,
  speedLevel,
  simulationTarget = null,
  onSimulationTargetReached,
  showSettings,
  draftView,
  isUserDraftModalOpen = false,
  isControlsBusy = false,
  onBackToBoard,
  onSpeedChange,
  onTogglePause,
  onOfferTrade,
  onToggleSettings,
  onDraftPlayer,
  onSessionUpdate,
  onTradeUpdate,
  onTradeBusyChange,
  onClockDisplayChange,
}: ActiveDraftRoomProps) {
  const { push: pushToast } = useToast();
  const currentPick = session.picks[session.currentPickIndex];
  const onClock =
    currentPick?.ownerTeamAbbr === session.userTeamAbbr && !currentPick?.selectedPlayerId;
  const [visibleProfileIds, setVisibleProfileIds] = React.useState<string[]>([]);
  const [mobilePanel, setMobilePanel] = React.useState<'board' | 'order' | 'feed'>('feed');
  const [tradeBusy, setTradeBusy] = React.useState(false);
  const [tradeOpenRequest, setTradeOpenRequest] = React.useState(0);
  const [selectedBoardPlayerId, setSelectedBoardPlayerId] = React.useState<string | null>(null);
  const [isProspectModalOpen, setIsProspectModalOpen] = React.useState(false);
  const [boardTab, setBoardTab] = React.useState<'available' | 'my-board' | 'needs' | 'analysis'>(
    'available',
  );
  const [personalBoardIds, setPersonalBoardIds] = React.useState<string[]>([]);
  const userTeam = React.useMemo(
    () => teams.find((team) => team.abbr === session.userTeamAbbr) ?? null,
    [session.userTeamAbbr, teams],
  );
  const pushAlert = useFalcoAlertStore((state) => state.pushAlert);
  const advanceInFlight = React.useRef(false);
  const skipInFlight = React.useRef(false);
  const sessionRef = React.useRef(session);
  const previousPickSelections = React.useRef<Map<string, string | null>>(new Map());
  const firedFreeFallRef = React.useRef(false);
  const lastRunRef = React.useRef<string | null>(null);
  const lastCompletedRoundToastRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  React.useEffect(() => {
    const loadPersonalBoard = () => {
      try {
        const next =
          localStorage.getItem(`dd-draft-big-board:${saveId}:${year}`) ??
          localStorage.getItem(`dd-draft-big-board:${saveId}`);
        setPersonalBoardIds(next ? JSON.parse(next) : []);
      } catch {
        setPersonalBoardIds([]);
      }
    };
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) setPersonalBoardIds(detail);
      else loadPersonalBoard();
    };
    loadPersonalBoard();
    window.addEventListener('dd-big-board-updated', handleUpdate);
    return () => window.removeEventListener('dd-big-board-updated', handleUpdate);
  }, [saveId, year]);

  React.useEffect(() => {
    if (draftView === 'trade') {
      setTradeOpenRequest((n) => n + 1);
      setMobilePanel('feed');
      onBackToBoard();
    }
  }, [draftView, onBackToBoard]);

  React.useEffect(() => {
    firedFreeFallRef.current = false;
    lastRunRef.current = null;
  }, [session.id]);

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
  const fullBoardEntries = React.useMemo(
    () =>
      rankDraftBoard({
        prospects: session.prospects,
        teamNeeds,
        currentPickOverall: currentPick?.overall ?? session.currentPickIndex + 1,
        limit: session.prospects.length,
      }),
    [currentPick?.overall, session.currentPickIndex, session.prospects, teamNeeds],
  );
  const personalBoardEntries = React.useMemo(
    () =>
      personalBoardIds
        .map((id) => fullBoardEntries.find((entry) => entry.player.id === id))
        .filter((entry): entry is (typeof fullBoardEntries)[number] => Boolean(entry)),
    [fullBoardEntries, personalBoardIds],
  );
  const topRankedEntries = React.useMemo(
    () =>
      boardEntries.slice().sort((left, right) => {
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
    if (
      selectedBoardPlayerId &&
      !bestAvailable.some((player) => player.id === selectedBoardPlayerId)
    ) {
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

  const targetReached = reachedDraftSimulationTarget(session, simulationTarget);
  const autoPickUser = Boolean(simulationTarget && simulationTarget.kind !== 'user_pick');
  React.useEffect(() => {
    if (targetReached) onSimulationTargetReached?.();
  }, [targetReached, onSimulationTargetReached]);

  const advanceCpuPick = React.useCallback(async () => {
    if (advanceInFlight.current || skipInFlight.current || !saveId || sessionRef.current.isPaused) {
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
            autoPickUser,
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
        throw new Error(payload.ok ? 'Unable to advance draft' : payload.error);
      }
      onSessionUpdate(payload.session);
    } catch (error) {
      pushToast({
        variant: 'info',
        title: 'Draft could not advance',
        description: error instanceof Error ? error.message : 'Please retry.',
      });
      if (!sessionRef.current.isPaused) onTogglePause();
    } finally {
      advanceInFlight.current = false;
    }
  }, [
    draftSessionId,
    onSessionUpdate,
    saveId,
    saveSnapshot,
    onTogglePause,
    pushToast,
    autoPickUser,
  ]);

  const { secondsRemaining } = useDraftClock({
    clockKey: currentPick ? `${session.id}:${currentPick.id}:${currentPick.ownerTeamAbbr}` : null,
    enabled:
      session.status === 'in_progress' &&
      !targetReached &&
      !session.isPaused &&
      !isControlsBusy &&
      !isUserDraftModalOpen &&
      !tradeBusy,
    durationSeconds: onClock ? USER_PICK_DURATION_SECONDS : 45,
    rate: simulationTarget ? 4500 : onClock ? 1 : SPEED_RATES[speedLevel],
    onExpire: async () => {
      // Explicit next-pick, end-of-round, and end-of-draft simulations may pick for the user.
      if ((!onClock || autoPickUser) && !targetReached && !sessionRef.current.isPaused)
        await advanceCpuPick();
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
        lines: [
          "He's slipping.",
          "Something's spooked teams. Could be noise. Could be real.",
          'Trust your read.',
        ],
        createdAt: new Date().toISOString(),
      });
    }
  }, [pushAlert, session.currentPickIndex, session.fallingProspectId, session.prospects]);

  React.useEffect(() => {
    if (session.maxRounds <= 1) return;
    const current = session.picks[session.currentPickIndex];
    if (!current) return;
    if (current.round <= 1 || current.round > session.maxRounds) return;

    const completedRound = current.round - 1;
    if (lastCompletedRoundToastRef.current === completedRound) return;
    lastCompletedRoundToastRef.current = completedRound;

    const fallingLastName =
      session.fallingProspectId &&
      !session.prospects.find((player) => player.id === session.fallingProspectId)?.isDrafted
        ? (session.prospects.find((player) => player.id === session.fallingProspectId)?.lastName ??
          null)
        : null;

    pushToast({
      id: `league-buzz:round-transition:${session.id}:${completedRound}`,
      kind: 'leagueBuzz',
      durationMs: 4200,
      leagueBuzz: generateRoundTransitionBuzzToast({
        roundNumber: completedRound,
        nextRound: current.round,
        fallingPlayerLastName: fallingLastName,
        teamAbbr: session.userTeamAbbr,
      }),
    });
  }, [
    pushToast,
    session.currentPickIndex,
    session.fallingProspectId,
    session.id,
    session.maxRounds,
    session.picks,
    session.prospects,
    session.userTeamAbbr,
  ]);

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

  const inspectedPlayer =
    (selectedBoardPlayerId
      ? bestAvailable.find((player) => player.id === selectedBoardPlayerId)
      : null) ?? spotlightPlayer;
  const clockText = `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`;
  const clockPickId = currentPick?.id;
  React.useEffect(() => {
    if (clockPickId) onClockDisplayChange?.({ pickId: clockPickId, text: clockText });
  }, [clockPickId, clockText, onClockDisplayChange]);

  React.useEffect(() => {
    if (
      !onClock ||
      isControlsBusy ||
      tradeBusy ||
      !onDraftPlayer ||
      !inspectedPlayer ||
      isProspectModalOpen
    )
      return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target?.tagName ?? '')
      ) {
        return;
      }
      event.preventDefault();
      void onDraftPlayer(inspectedPlayer);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedPlayer, tradeBusy, isProspectModalOpen, onClock, onDraftPlayer, isControlsBusy]);

  return (
    <>
      <nav className={styles.mobileLiveNav} aria-label="Live draft panels">
        {(['order', 'feed', 'board'] as const).map((panel) => (
          <button
            type="button"
            key={panel}
            aria-pressed={mobilePanel === panel}
            onClick={() => setMobilePanel(panel)}
          >
            {panel === 'board' ? 'Player Board' : panel === 'order' ? 'Draft Feed' : 'Trade Hub'}
          </button>
        ))}
      </nav>
      <div
        className={`${styles.draftWorkspace} ${styles.liveWorkspace}`}
        data-mobile-panel={mobilePanel}
      >
        <LiveDraftPanels session={session} teams={teams} clockText={clockText} />
        <MockTradeHub
          session={session}
          teams={teams}
          saveId={saveId}
          saveSnapshot={saveSnapshot}
          onUpdate={onTradeUpdate}
          onBusy={(busy) => {
            setTradeBusy(busy);
            onTradeBusyChange(busy);
          }}
          busy={isControlsBusy || advanceInFlight.current}
          openRequest={tradeOpenRequest}
          onReveal={() => setMobilePanel('feed')}
        />
        <section className={`${styles.workspacePanel} ${styles.boardPanel} ${styles.playersRail}`}>
          <header className={styles.playersHeader}>
            <h2>Available Players</h2>
          </header>

          <div className={styles.boardTabs}>
            <button
              type="button"
              className={boardTab === 'available' ? styles.activeTab : undefined}
              onClick={() => setBoardTab('available')}
            >
              Best Available
            </button>
            <button
              type="button"
              className={boardTab === 'my-board' ? styles.activeTab : undefined}
              onClick={() => setBoardTab('my-board')}
            >
              My Board
            </button>
            <button
              type="button"
              className={boardTab === 'needs' ? styles.activeTab : undefined}
              onClick={() => setBoardTab('needs')}
            >
              Team Needs
            </button>
            <button
              type="button"
              className={boardTab === 'analysis' ? styles.activeTab : undefined}
              onClick={() => setBoardTab('analysis')}
            >
              Analysis
            </button>
          </div>

          {showSettings ? (
            <div className={styles.settingsTray}>
              <strong>Simulation speed</strong>
              {(['Normal', 'Fast', 'Instant'] as const).map((label, index) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={speedLevel === index}
                  onClick={() => onSpeedChange(index as DraftSpeedLevel)}
                >
                  {label}
                </button>
              ))}
              <button type="button" onClick={onTogglePause}>
                {session.isPaused ? 'Resume' : 'Pause'}
              </button>
              <span>CPU speed changes immediately. Your picks always wait for you.</span>
            </div>
          ) : null}

          <div className={styles.boardTable}>
            {onClock && (
              <div className={styles.userPickNotice}>
                <strong>Your pick — choose a player below.</strong>
                {session.isPaused && <span>You can make your selection while paused.</span>}
              </div>
            )}
            {boardTab === 'analysis' ? (
              <div className={styles.analysisView}>
                <h3>Live draft analysis</h3>
                <p>
                  {session.picks.filter((pick) => pick.selectedPlayerId).length} selections have
                  been made.{' '}
                  {activeRuns[0]?.headline ?? 'No active position run is affecting the board.'}
                </p>
              </div>
            ) : (
              <DraftSimulatorProspectTable
                onVisiblePlayersChange={setVisibleProfileIds}
                compact
                hideWatchlistAction
                onDraftPlayer={onClock ? onDraftPlayer : undefined}
                draftDisabled={isControlsBusy || tradeBusy}
                entries={
                  boardTab === 'my-board'
                    ? personalBoardEntries
                    : boardTab === 'needs'
                      ? fullBoardEntries.filter((entry) =>
                          teamNeeds.includes(entry.player.position),
                        )
                      : fullBoardEntries
                }
                teamNeeds={teamNeeds}
                activeRuns={activeRuns}
                selectedPlayerId={selectedBoardPlayerId}
                onSelectPlayer={(id) => {
                  setSelectedBoardPlayerId(id);
                  setIsProspectModalOpen(true);
                }}
                watchlist={personalBoardIds}
                onToggleWatchlist={(id) => {
                  const next = personalBoardIds.includes(id)
                    ? personalBoardIds.filter((value) => value !== id)
                    : [...personalBoardIds, id];
                  setPersonalBoardIds(next);
                  localStorage.setItem(
                    `dd-draft-big-board:${saveId}:${year}`,
                    JSON.stringify(next),
                  );
                  window.dispatchEvent(new CustomEvent('dd-big-board-updated', { detail: next }));
                }}
                boardOrder={boardTab === 'my-board'}
              />
            )}
          </div>
          <div className={styles.draftActions}>
            <Button variant="outline" onClick={onOfferTrade}>
              <ArrowLeftRight /> Propose Trade
            </Button>
            <Button
              disabled={
                !onClock || !onDraftPlayer || !inspectedPlayer || isControlsBusy || tradeBusy
              }
              onClick={() =>
                inspectedPlayer && onDraftPlayer && void onDraftPlayer(inspectedPlayer)
              }
            >
              <CheckCircle2 /> Make Pick
            </Button>
          </div>
        </section>
      </div>

      <ProspectDetailsModal
        closeLabel="Back to Draft Feed"
        open={isProspectModalOpen}
        player={inspectedPlayer}
        players={visibleProfileIds.flatMap((id) => {
          const entry = topRankedEntries.find((e) => e.player.id === id);
          return entry ? [entry.player] : [];
        })}
        year={year}
        teamAbbr={session.userTeamAbbr}
        boardEntry={boardEntries.find((entry) => entry.player.id === inspectedPlayer?.id) ?? null}
        teamNeeds={teamNeeds}
        activeRuns={activeRuns}
        canDraft={Boolean(onClock && onDraftPlayer)}
        draftBusy={isControlsBusy || tradeBusy}
        onSelectPlayer={setSelectedBoardPlayerId}
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
    </>
  );
}
