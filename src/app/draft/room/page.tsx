'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftRight, ArrowRight, CheckCircle2, ChevronDown, Settings } from 'lucide-react';

import { DraftDialog } from '@/components/draft/live-draft-panels';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DraftSimulationTarget } from '@/lib/draft-simulation-target';
import AppShell from '@/components/app-shell';
import { FrontOfficeSupportingPanels } from '@/components/front-office/front-office-supporting-panels';
import { DraftSimulatorProspectTable } from '@/components/draft/draft-simulator-prospect-table';
import { DraftExperienceHero } from '@/components/draft/draft-experience-hero';
import { ActiveDraftRoom, type DraftSpeedLevel } from '@/components/draft/active-draft-room';
import { DraftRecapModal } from '@/components/draft/draft-recap-modal';
import { PickAnnouncement } from '@/components/draft/pick-announcement';
import { ProspectDetailsModal } from '@/components/draft/prospect-details-modal';
import { buildRoundOneOrder, getTeamNeeds } from '@/components/draft/draft-utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { OFFSEASON_STEPS } from '@/features/experience/offseason-steps';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { rankDraftBoard } from '@/lib/draft-board';
import type { DraftBoardEntry } from '@/lib/draft-board';
import {
  detectActiveDraftRuns,
  evaluateDraftPick,
  summarizeDraftClass,
} from '@/lib/draft-intelligence';
import { OFFSEASON_PROGRESS_POINTS } from '@/lib/offseason-progress';
import { buildProspectDetailsModel } from '@/lib/draft-prospect-details';
import { buildFalcoBoard } from '@/lib/falco';
import { apiFetch } from '@/lib/api';
import { isDraftWorkflowAvailable } from '@/lib/front-office-phase';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';
import { buildTop32Prospects } from '@/server/data/prospects-top32';
import type { DraftMode, DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveBootstrapDTO } from '@/types/save';
import type { TeamDTO } from '@/types/team';
import styles from './mock-draft-room.module.css';

export const dynamic = 'force-dynamic';

type DraftSessionResponse = { ok: true; session: DraftSessionDTO } | { ok: false; error: string };

type DraftPickResponse =
  | {
      ok: true;
      session: DraftSessionDTO;
      grade: { letter: string; reasons: string[] };
      draftedPlayer: PlayerRowDTO;
    }
  | { ok: false; error: string };

type DraftSessionStartResponse =
  | { ok: true; draftSessionId: string; session?: DraftSessionDTO }
  | { ok: false; error: string };

type ActiveDraftSessionResponse =
  | { ok: true; session: DraftSessionDTO | null }
  | { ok: false; error: string };

type TeamsResponse = {
  teams: TeamDTO[];
};

const parseDraftSessionStartResponse = (text: string): DraftSessionStartResponse =>
  text ? (JSON.parse(text) as DraftSessionStartResponse) : { ok: false, error: 'Empty response' };

function PreDraftWorkspace({
  entries,
  teams,
  teamAbbr,
  draftYear,
  selectedPlayerId,
  onSelectPlayer,
  onOpenPlayer,
  onVisiblePlayersChange,
}: {
  entries: DraftBoardEntry[];
  teams: TeamDTO[];
  teamAbbr: string;
  draftYear: number;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  onOpenPlayer: () => void;
  onVisiblePlayersChange: (ids: string[]) => void;
}) {
  const boardSaveId = useSaveStore((state) => state.saveId);
  const [personalBoardIds, setPersonalBoardIds] = React.useState<string[]>([]);
  const [orderTab, setOrderTab] = React.useState<'order' | 'needs'>('order');
  const [boardTab, setBoardTab] = React.useState<
    'available' | 'my-board' | 'needs' | 'trade' | 'analysis'
  >('available');
  const [profileTab, setProfileTab] = React.useState<'overview' | 'stats' | 'film' | 'comparisons'>(
    'overview',
  );
  React.useEffect(() => {
    const load = () => {
      try {
        const stored =
          localStorage.getItem(`dd-draft-big-board:${boardSaveId}:${draftYear}`) ??
          localStorage.getItem(`dd-draft-big-board:${boardSaveId}`);
        setPersonalBoardIds(stored ? JSON.parse(stored) : []);
      } catch {
        setPersonalBoardIds([]);
      }
    };
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) setPersonalBoardIds(detail);
      else load();
    };
    load();
    window.addEventListener('dd-big-board-updated', handleUpdate);
    return () => window.removeEventListener('dd-big-board-updated', handleUpdate);
  }, [boardSaveId, draftYear]);
  const needs = getTeamNeeds(teamAbbr, teams);
  const selectedEntry =
    entries.find((entry) => entry.player.id === selectedPlayerId) ?? entries[0] ?? null;
  const details = selectedEntry
    ? buildProspectDetailsModel({
        player: selectedEntry.player,
        boardEntry: selectedEntry,
        teamNeeds: needs,
        activeRuns: [],
      })
    : null;
  const teamLookup = new Map(teams.map((team) => [team.abbr, team]));
  const order = buildRoundOneOrder(teams).slice(0, 12);
  const controlledTeam = teamLookup.get(teamAbbr);
  const personalEntries = personalBoardIds
    .map((id) => entries.find((entry) => entry.player.id === id))
    .filter((entry): entry is DraftBoardEntry => Boolean(entry));

  return (
    <div className={styles.draftWorkspace}>
      <aside className={`${styles.workspacePanel} ${styles.draftOrderPanel}`}>
        <div className={styles.panelTabs}>
          <button
            type="button"
            className={orderTab === 'order' ? styles.activeTab : undefined}
            onClick={() => setOrderTab('order')}
          >
            Draft Order
          </button>
          <button
            type="button"
            className={orderTab === 'needs' ? styles.activeTab : undefined}
            onClick={() => setOrderTab('needs')}
          >
            Team Needs
          </button>
        </div>
        <div className={styles.pickList}>
          {order.map((pick) => {
            const team = teamLookup.get(pick.abbr);
            return (
              <div
                key={pick.pickNumber}
                className={pick.pickNumber === 1 ? styles.currentPick : styles.pickRow}
              >
                <span className={styles.pickNumber}>{pick.pickNumber}</span>
                {team?.logoUrl ? (
                  <Image src={team.logoUrl} alt="" width={28} height={28} unoptimized />
                ) : null}
                <div>
                  <strong>{team?.name ?? pick.abbr}</strong>
                  <small>{getTeamNeeds(pick.abbr, teams).slice(0, 3).join(', ')}</small>
                </div>
                {pick.pickNumber === 1 && orderTab === 'order' ? (
                  <span className={styles.clockBadge}>First pick</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>
      <section className={`${styles.workspacePanel} ${styles.boardPanel}`}>
        <div className={styles.onClockHeader}>
          <div className={styles.onClockTeam}>
            {controlledTeam?.logoUrl ? (
              <Image src={controlledTeam.logoUrl} alt="" width={48} height={48} unoptimized />
            ) : null}
            <div>
              <strong>{controlledTeam?.name ?? teamAbbr}</strong>
              <span>Draft room ready</span>
            </div>
          </div>
          <div className={styles.needChips}>
            <span>Team Needs</span>
            {needs.slice(0, 4).map((need) => (
              <b key={need}>{need}</b>
            ))}
          </div>
          <div className={styles.headerClock}>
            <span>Draft Clock</span>
            <strong>Ready</strong>
          </div>
        </div>
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
            className={boardTab === 'trade' ? styles.activeTab : undefined}
            onClick={() => setBoardTab('trade')}
          >
            Trade
          </button>
          <button
            type="button"
            className={boardTab === 'analysis' ? styles.activeTab : undefined}
            onClick={() => setBoardTab('analysis')}
          >
            Analysis
          </button>
        </div>
        <div className={styles.boardTable}>
          {boardTab === 'needs' ? (
            <div className={styles.teamNeedsView}>
              <h3>{controlledTeam?.name ?? teamAbbr} team needs</h3>
              {needs.map((need, index) => (
                <p key={need}>
                  <strong>{index + 1}</strong>
                  {need}
                </p>
              ))}
            </div>
          ) : boardTab === 'trade' ? (
            <div className={styles.analysisView}>
              <h3>Draft trades</h3>
              <p>Start the mock draft to propose and review live trade offers.</p>
            </div>
          ) : boardTab === 'analysis' ? (
            <div className={styles.analysisView}>
              <h3>Pre-draft analysis</h3>
              <p>
                Select a prospect to compare the current board with the controlled team’s roster
                needs.
              </p>
            </div>
          ) : (
            <DraftSimulatorProspectTable
              onVisiblePlayersChange={onVisiblePlayersChange}
              entries={boardTab === 'my-board' ? personalEntries : entries}
              teamNeeds={needs}
              selectedPlayerId={selectedEntry?.player.id ?? null}
              onSelectPlayer={onSelectPlayer}
              boardOrder={boardTab === 'my-board'}
            />
          )}
        </div>
        <div className={styles.draftActions}>
          <Button variant="outline" disabled>
            <ArrowLeftRight /> Propose Trade
          </Button>
          <Button disabled>
            <CheckCircle2 /> Make Pick
          </Button>
        </div>
      </section>
      <aside className={`${styles.workspacePanel} ${styles.prospectPanel}`}>
        {details && selectedEntry ? (
          <>
            <div className={styles.prospectHeader}>
              {details.headshotUrl ? (
                <Image src={details.headshotUrl} alt="" width={72} height={72} unoptimized />
              ) : (
                <div className={styles.prospectFallback}>
                  {selectedEntry.player.firstName[0]}
                  {selectedEntry.player.lastName[0]}
                </div>
              )}
              <div>
                <strong>{details.name}</strong>
                <span>
                  {details.position} · {details.school}
                </span>
              </div>
            </div>
            <div className={styles.profileTabs}>
              {(['overview', 'stats', 'film', 'comparisons'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={profileTab === tab ? styles.activeTab : undefined}
                  onClick={() => setProfileTab(tab)}
                >
                  {tab === 'film' ? 'Film Room' : `${tab[0].toUpperCase()}${tab.slice(1)}`}
                </button>
              ))}
            </div>
            {profileTab === 'overview' ? (
              <>
                <div className={styles.gradeCard}>
                  <div>
                    <span>D&amp;D Grade</span>
                    <strong className="front-office-stat-value">{details.ratingDisplay}</strong>
                    <small>{details.projectedRange}</small>
                  </div>
                  <p>{selectedEntry.player.summary ?? 'No scouting summary added yet.'}</p>
                </div>
                <div className={styles.measurements}>
                  {details.height ? (
                    <div>
                      <span>Height</span>
                      <strong>{details.height}</strong>
                    </div>
                  ) : null}
                  {details.weight ? (
                    <div>
                      <span>Weight</span>
                      <strong>{details.weight} lbs</strong>
                    </div>
                  ) : null}
                  {details.age ? (
                    <div>
                      <span>Age</span>
                      <strong>{details.age}</strong>
                    </div>
                  ) : null}
                </div>
              </>
            ) : profileTab === 'stats' ? (
              <div className={styles.profileEmptyState}>
                {selectedEntry.player.stats
                  ? 'Available college statistics are included in the full player profile.'
                  : 'No college stats added yet.'}
              </div>
            ) : profileTab === 'film' ? (
              <div className={styles.profileEmptyState}>No film added yet.</div>
            ) : (
              <div className={styles.profileEmptyState}>No player comparisons added yet.</div>
            )}
            <button type="button" className={styles.profileButton} onClick={onOpenPlayer}>
              View Full Player Profile →
            </button>
          </>
        ) : (
          <p className={styles.emptyProspect}>No prospects are available.</p>
        )}
      </aside>
    </div>
  );
}

function DraftRoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modeParam = searchParams?.get('mode');
  const mode: DraftMode = modeParam === 'real' ? 'real' : 'mock';
  React.useEffect(() => {
    document.body.classList.add('mock-draft-room-active');
    return () => document.body.classList.remove('mock-draft-room-active');
  }, []);
  const [visibleProfileIds, setVisibleProfileIds] = React.useState<string[]>([]);
  const [session, setSession] = React.useState<DraftSessionDTO | null>(null);
  const [exitOpen, setExitOpen] = React.useState(false);
  const pausedRef = React.useRef(false);
  const deferredSession = React.useRef<DraftSessionDTO | null>(null);
  const acceptSessionUpdate = React.useCallback((next: DraftSessionDTO) => {
    setSession((current) => {
      if (
        current &&
        ((next.tradeRevision ?? 0) < (current.tradeRevision ?? 0) ||
          next.currentPickIndex < current.currentPickIndex)
      )
        return current;
      if (pausedRef.current) {
        deferredSession.current = next;
        return current;
      }
      return next;
    });
  }, []);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [simulationTarget, setSimulationTarget] = React.useState<DraftSimulationTarget | null>(
    null,
  );
  const [primarySimulationAction, setPrimarySimulationAction] = React.useState<
    'user_pick' | 'next_pick'
  >('user_pick');
  React.useEffect(() => {
    try {
      if (localStorage.getItem('dd-draft-primary-simulation') === 'next_pick') {
        setPrimarySimulationAction('next_pick');
      }
    } catch {
      // The control still remembers the selection in memory when storage is unavailable.
    }
  }, []);
  const [speedLevel, setSpeedLevel] = React.useState<DraftSpeedLevel>(0);
  const [draftView, setDraftView] = React.useState<'board' | 'trade'>('board');
  const [teams, setTeams] = React.useState<TeamsResponse['teams']>([]);
  const [selectedPickNumber] = React.useState(1);
  const [lobbyMessage, setLobbyMessage] = React.useState('');
  const [showSettings, setShowSettings] = React.useState(false);
  const [pickAnnouncementPlayer, setPickAnnouncementPlayer] = React.useState<PlayerRowDTO | null>(
    null,
  );
  const [pickAnnouncementOpen, setPickAnnouncementOpen] = React.useState(false);
  const [pickAnnouncementGrade, setPickAnnouncementGrade] = React.useState<string | null>(null);
  const [selectedLobbyPlayerId, setSelectedLobbyPlayerId] = React.useState<string | null>(null);
  const [isLobbyProspectModalOpen, setIsLobbyProspectModalOpen] = React.useState(false);
  const [clockDisplay, setClockDisplay] = React.useState<{ pickId: string; text: string } | null>(
    null,
  );
  const [draftControlBusy, setDraftControlBusy] = React.useState(false);
  const [isDraftSetupOpen, setIsDraftSetupOpen] = React.useState(false);
  const [pendingDraftRounds, setPendingDraftRounds] = React.useState<number | null>(null);

  const saveId = useSaveStore((state) => state.saveId);
  const [resolvedSaveId, setResolvedSaveId] = React.useState(saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const roster = useSaveStore((state) => state.roster);
  const phase = useSaveStore((state) => state.phase);
  const unlocked = useSaveStore((state) => state.unlocked);
  const activeDraftSessionId = useSaveStore((state) => state.activeDraftSessionId);
  const setActiveDraftSessionId = useSaveStore((state) => state.setActiveDraftSessionId);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const setRoster = useSaveStore((state) => state.setRoster);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);
  const setIsUserOnClock = useSaveStore((state) => state.setIsUserOnClock);
  const selectedDraftRounds = useSaveStore((state) => state.selectedDraftRounds);
  const franchiseYear = useSaveStore((state) => state.franchiseYear);
  const draftYear = franchiseYear + 1;
  const setSelectedDraftRounds = useSaveStore((state) => state.setSelectedDraftRounds);
  const setLatestDraftRecap = useSaveStore((state) => state.setLatestDraftRecap);
  const modeExperience = useExperienceStore((state) => state.mode);
  const currentStep = useExperienceStore((state) => state.currentStep);
  const completedSteps = useExperienceStore((state) => state.completedSteps);
  const completeCurrentStep = useExperienceStore((state) => state.completeCurrentStep);
  const skipCurrentStep = useExperienceStore((state) => state.skipCurrentStep);
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);
  const { push: pushToast } = useToast();
  const storedTeams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const selectedTeam = React.useMemo(
    () => storedTeams.find((team) => team.id === selectedTeamId) ?? storedTeams[0] ?? null,
    [selectedTeamId, storedTeams],
  );
  const [isDraftRecapOpen, setIsDraftRecapOpen] = React.useState(false);
  const falcoSeed = `${saveId ?? 'global'}-${session?.id ?? 'lobby'}`;
  const falcoBoard = React.useMemo(
    () => buildFalcoBoard(session?.prospects ?? buildTop32Prospects(draftYear), falcoSeed),
    [draftYear, falcoSeed, session?.prospects],
  );
  const trackProgress = React.useCallback(
    (eventKey: string, points: number, message: string, detail = 'Draft') => {
      if (!saveId) return;
      const result = recordProgressEvent({
        saveId,
        step: 'draft',
        eventKey,
        points,
      });
      if (!result.changed) return;
      pushToast({
        id: `progress:${saveId}:${eventKey}`,
        kind: 'progress',
        durationMs: 3400,
        progress: { message, detail },
      });
    },
    [pushToast, recordProgressEvent, saveId],
  );

  const userOnClock = React.useMemo(() => {
    if (!session) return false;
    const currentPick = session.picks[session.currentPickIndex];
    return currentPick?.ownerTeamAbbr === session.userTeamAbbr && !currentPick?.selectedPlayerId;
  }, [session]);

  React.useEffect(() => {
    if (saveId) {
      setResolvedSaveId(saveId);
    }
  }, [saveId]);

  React.useEffect(() => {
    if (!session && pendingDraftRounds === null) {
      setPendingDraftRounds(selectedDraftRounds);
    }
  }, [pendingDraftRounds, selectedDraftRounds, session]);

  React.useEffect(() => {
    setIsUserOnClock(userOnClock);
  }, [setIsUserOnClock, userOnClock]);

  React.useEffect(() => {
    return () => setIsUserOnClock(false);
  }, [setIsUserOnClock]);

  React.useEffect(() => {
    if (modeExperience !== 'full' || mode === 'mock') return;
    if (session?.status === 'completed' && !completedSteps.includes('draft')) {
      if (saveId) {
        recordProgressEvent({
          saveId,
          step: 'draft',
          eventKey: 'finish:draft',
          complete: true,
        });
      }
      completeCurrentStep();
    }
  }, [
    mode,
    modeExperience,
    session?.status,
    completedSteps,
    completeCurrentStep,
    recordProgressEvent,
    saveId,
  ]);

  const userTeam = React.useMemo(() => {
    if (!session) return null;
    return teams.find((team) => team.abbr === session.userTeamAbbr) ?? null;
  }, [session, teams]);

  const ensureSaveExists = React.useCallback(
    async (forcePhase?: 'draft') => {
      const preferredSaveId = resolvedSaveId || saveId;

      if (preferredSaveId) {
        const headerParams = new URLSearchParams({ saveId: preferredSaveId });
        const resolvedTeamAbbr = teamAbbr || selectedTeam?.abbr;
        if (resolvedTeamAbbr) {
          headerParams.set('teamAbbr', resolvedTeamAbbr);
        }
        const headerResponse = await apiFetch(
          `/api/saves/header?${headerParams.toString()}`,
          undefined,
          {
            skipSaveGuard: true,
          },
        );
        if (headerResponse.ok) {
          const headerData = (await headerResponse.json()) as
            | (SaveBootstrapDTO & { unlocked?: SaveBootstrapDTO['unlocked'] })
            | { ok: false; error: string };
          if (headerData.ok) {
            const resolvedPhase = forcePhase ?? headerData.phase;
            setResolvedSaveId(headerData.saveId);
            setSaveHeader(
              {
                ...headerData,
                unlocked: headerData.unlocked ?? { freeAgency: false, draft: false },
                phase: resolvedPhase,
                createdAt: new Date().toISOString(),
              },
              teamId,
            );
            return headerData.saveId;
          }
        }
      }

      const resolvedTeamId = teamId || selectedTeam?.id;
      const resolvedTeamAbbr = teamAbbr || selectedTeam?.abbr;

      if (!resolvedTeamAbbr && !resolvedTeamId) {
        return null;
      }

      return ensureRecoverableSaveId(
        {
          preferredSaveId,
          teamId: resolvedTeamId,
          teamAbbr: resolvedTeamAbbr,
          year: franchiseYear,
          capSpace,
          capLimit,
          roster,
          phase: forcePhase ?? phase,
          unlocked,
        },
        (header, nextTeamId) => {
          setResolvedSaveId(header.saveId);
          setSaveHeader(
            {
              ...header,
              phase: forcePhase ?? header.phase,
            },
            nextTeamId,
          );
        },
      );
    },
    [
      capLimit,
      capSpace,
      phase,
      resolvedSaveId,
      roster,
      saveId,
      selectedTeam?.abbr,
      selectedTeam?.id,
      setSaveHeader,
      teamAbbr,
      teamId,
      unlocked,
      franchiseYear,
    ],
  );
  const userSelections = React.useMemo(() => {
    if (!session) {
      return [];
    }
    return session.picks
      .filter((pick) => pick.selectedByTeamAbbr === session.userTeamAbbr && pick.selectedPlayerId)
      .map((pick) => session.prospects.find((player) => player.id === pick.selectedPlayerId))
      .filter((player): player is PlayerRowDTO => Boolean(player));
  }, [session]);

  const draftRecap = React.useMemo(() => {
    if (!session) {
      return null;
    }

    const teamNeeds = getTeamNeeds(session.userTeamAbbr, teams);
    const entries = session.picks
      .filter((pick) => pick.selectedByTeamAbbr === session.userTeamAbbr && pick.selectedPlayerId)
      .map((pick) => {
        const player = session.prospects.find((prospect) => prospect.id === pick.selectedPlayerId);
        if (!player) {
          return null;
        }

        const evaluation = evaluateDraftPick({
          player,
          currentPickOverall: pick.overall,
          teamNeeds,
        });

        return { pick, player, evaluation };
      })
      .filter(
        (
          entry,
        ): entry is {
          pick: DraftSessionDTO['picks'][number];
          player: PlayerRowDTO;
          evaluation: ReturnType<typeof evaluateDraftPick>;
        } => Boolean(entry),
      );

    return {
      entries,
      summary: summarizeDraftClass({
        picks: entries.map(({ pick, player }) => ({ pick, player })),
        evaluations: entries.map(({ evaluation }) => evaluation),
        teamNeeds,
      }),
    };
  }, [session, teams]);

  const roundOneOrder = React.useMemo(() => buildRoundOneOrder(teams), [teams]);
  const lobbyProspects = React.useMemo(() => buildTop32Prospects(draftYear), [draftYear]);

  const selectedPick = React.useMemo(
    () =>
      roundOneOrder.find((pick) => pick.pickNumber === selectedPickNumber) ??
      roundOneOrder[0] ??
      null,
    [roundOneOrder, selectedPickNumber],
  );
  const userNextPickIndex = React.useMemo(() => {
    if (session) {
      const nextPick = session.picks.find(
        (pick) =>
          pick.ownerTeamAbbr === session.userTeamAbbr &&
          pick.overall >= session.currentPickIndex + 1 &&
          !pick.selectedPlayerId,
      );
      return nextPick?.overall ?? null;
    }
    const userPick = roundOneOrder.find((pick) => pick.abbr === (teamAbbr || selectedTeam?.abbr));
    return userPick?.pickNumber ?? null;
  }, [roundOneOrder, selectedTeam?.abbr, session, teamAbbr]);
  const lobbyBoardEntries = React.useMemo(
    () =>
      rankDraftBoard({
        prospects: lobbyProspects,
        teamNeeds: getTeamNeeds(teamAbbr || selectedTeam?.abbr || 'KC', teams),
        currentPickOverall: userNextPickIndex ?? 1,
        limit: lobbyProspects.length,
      }),
    [lobbyProspects, selectedTeam?.abbr, teamAbbr, teams, userNextPickIndex],
  );
  const selectedLobbyPlayer =
    (selectedLobbyPlayerId
      ? lobbyProspects.find((player) => player.id === selectedLobbyPlayerId)
      : null) ??
    lobbyBoardEntries[0]?.player ??
    null;

  const fetchSession = React.useCallback(
    async (draftSessionId: string, saveIdOverride?: string | null) => {
      const actionableSaveId = saveIdOverride ?? resolvedSaveId ?? saveId;
      if (!actionableSaveId) {
        setError('Select a team to start a save.');
        return null;
      }
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ draftSessionId, saveId: actionableSaveId });
      const response = await apiFetch(`/api/draft/session?${query.toString()}`, undefined, {
        skipSaveGuard: true,
      });
      const payload = (await response.json()) as DraftSessionResponse;
      if (!response.ok || !payload.ok) {
        const message = payload.ok ? 'Unable to load draft data.' : payload.error;
        // Clear draft session if save or session not found
        if (message === 'Draft session not found' || message === 'Save not found') {
          setActiveDraftSessionId(null, actionableSaveId);
          setSession(null);
          setError('');
          setLoading(false);
          return null;
        }
        setError(message);
        setLoading(false);
        return null;
      } else {
        setSession(payload.session);
      }
      setLoading(false);
      return payload.session;
    },
    [resolvedSaveId, saveId, setActiveDraftSessionId],
  );

  const buildDraftSaveSnapshot = React.useCallback(
    (activeSaveId: string) => ({
      saveId: activeSaveId,
      teamAbbr: teamAbbr || selectedTeam?.abbr || roster[0]?.teamAbbr || 'KC',
      year: franchiseYear,
      capSpace,
      capLimit,
      roster,
      phase: mode === 'mock' ? phase : 'draft',
      unlocked: mode === 'mock' ? unlocked : { freeAgency: true, draft: true },
    }),
    [
      capLimit,
      capSpace,
      franchiseYear,
      roster,
      selectedTeam?.abbr,
      teamAbbr,
      mode,
      phase,
      unlocked,
    ],
  );

  const syncDraftPhase = React.useCallback(
    async (activeSaveId: string) => {
      if (mode === 'mock') return true;
      const response = await apiFetch(
        '/api/saves/phase',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildDraftSaveSnapshot(activeSaveId)),
        },
        { skipSaveGuard: true },
      );

      if (!response.ok) {
        return false;
      }

      const payload = (await response.json()) as
        | (SaveBootstrapDTO & { unlocked?: SaveBootstrapDTO['unlocked'] })
        | { ok: false; error: string };

      if (!payload.ok) {
        setError(payload.error);
        return false;
      }

      setResolvedSaveId(payload.saveId);
      setSaveHeader(
        {
          ...payload,
          unlocked: payload.unlocked ?? { freeAgency: true, draft: true },
        },
        teamId,
      );
      return true;
    },
    [buildDraftSaveSnapshot, setSaveHeader, teamId, mode],
  );

  const startDraft = React.useCallback(
    async (roundsOverride?: number) => {
      if (draftControlBusy) {
        return false;
      }

      setDraftControlBusy(true);
      setLoading(true);
      setError('');
      setLobbyMessage('');
      setDraftView('board');
      setShowSettings(false);

      try {
        const activeSaveId = await ensureSaveExists(mode === 'mock' ? undefined : 'draft');
        if (!activeSaveId) {
          setError('Select a team to start a save.');
          return false;
        }

        const phaseSynced = await syncDraftPhase(activeSaveId);
        if (!phaseSynced) {
          setLobbyMessage('Unable to prepare draft session.');
          return false;
        }

        const startWithSave = async (targetSaveId: string) => {
          const response = await apiFetch(
            '/api/draft/session',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...buildDraftSaveSnapshot(targetSaveId),
                mode,
                maxRounds: roundsOverride ?? selectedDraftRounds,
              }),
            },
            { skipSaveGuard: true },
          );
          const text = await response.text();
          return {
            response,
            payload: parseDraftSessionStartResponse(text),
          };
        };

        let activeStartSaveId = activeSaveId;
        let { response, payload } = await startWithSave(activeStartSaveId);

        if (!response.ok || !payload.ok) {
          if (!payload.ok && payload.error === 'Save not found') {
            const freshSaveId = await ensureSaveExists(mode === 'mock' ? undefined : 'draft');
            if (!freshSaveId) {
              setLobbyMessage(payload.error);
              return false;
            }
            const freshPhaseSynced = await syncDraftPhase(freshSaveId);
            if (!freshPhaseSynced) {
              setLobbyMessage('Unable to restore draft session.');
              return false;
            }
            activeStartSaveId = freshSaveId;
            ({ response, payload } = await startWithSave(activeStartSaveId));
          }
        }

        if (!response.ok || !payload.ok) {
          setLobbyMessage(payload.ok ? 'Unable to start draft.' : payload.error);
          return false;
        }

        setResolvedSaveId(activeStartSaveId);
        setActiveDraftSessionId(payload.draftSessionId, activeStartSaveId);
        if (payload.session) {
          setSession(payload.session);
        } else {
          await fetchSession(payload.draftSessionId, activeStartSaveId);
        }
        return true;
      } finally {
        setLoading(false);
        setDraftControlBusy(false);
      }
    },
    [
      draftControlBusy,
      ensureSaveExists,
      fetchSession,
      mode,
      selectedDraftRounds,
      setActiveDraftSessionId,
      buildDraftSaveSnapshot,
      syncDraftPhase,
    ],
  );

  const togglePause = React.useCallback(async () => {
    if (draftControlBusy) {
      return;
    }
    const actionableSaveId = resolvedSaveId || saveId;
    if (!actionableSaveId || !activeDraftSessionId || !session) {
      return;
    }
    setDraftControlBusy(true);
    const nextPaused = !session.isPaused;
    pausedRef.current = nextPaused;
    if (nextPaused) setSession({ ...session, isPaused: true });
    try {
      const response = await apiFetch(
        '/api/draft/session/pause',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saveId: actionableSaveId,
            draftSessionId: activeDraftSessionId,
            isPaused: nextPaused,
            sessionSnapshot: deferredSession.current ?? session,
            saveSnapshot: buildDraftSaveSnapshot(actionableSaveId),
          }),
        },
        { skipSaveGuard: true },
      );
      const payload = (await response.json()) as DraftSessionResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.ok ? 'Unable to update pause state' : payload.error);
        pausedRef.current = true;
        setSession((current) => (current ? { ...current, isPaused: true } : current));
        return;
      }
      if (nextPaused) {
        deferredSession.current = payload.session;
      } else {
        deferredSession.current = null;
        setSession(payload.session);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update pause state.');
      // Keep the local simulation stopped when the server cannot confirm resume.
      pausedRef.current = true;
      setSession((current) => (current ? { ...current, isPaused: true } : current));
    } finally {
      setDraftControlBusy(false);
    }
  }, [
    activeDraftSessionId,
    buildDraftSaveSnapshot,
    draftControlBusy,
    resolvedSaveId,
    saveId,
    session,
  ]);

  React.useEffect(() => {
    if (activeDraftSessionId) {
      void fetchSession(activeDraftSessionId, resolvedSaveId || saveId);
    }
  }, [activeDraftSessionId, fetchSession, resolvedSaveId, saveId]);

  React.useEffect(() => {
    if (session?.status === 'completed') {
      setIsDraftRecapOpen(true);
    }
  }, [session?.status]);

  React.useEffect(() => {
    const loadTeams = async () => {
      const response = await apiFetch('/api/teams');
      const payload = (await response.json()) as TeamDTO[];
      if (!response.ok) {
        return;
      }
      setTeams(payload);
    };

    void loadTeams();
  }, []);

  React.useEffect(() => {
    const actionableSaveId = resolvedSaveId || saveId;
    if (!actionableSaveId || activeDraftSessionId) {
      return;
    }

    const restoreActiveSession = async () => {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ saveId: actionableSaveId });
      const response = await apiFetch(`/api/draft/session/active?${query.toString()}`, undefined, {
        skipSaveGuard: true,
      });
      const payload = (await response.json()) as ActiveDraftSessionResponse;
      if (!response.ok || !payload.ok) {
        setLoading(false);
        setSession(null);
        setError('');
        return;
      }

      setSession(payload.session);
      setActiveDraftSessionId(payload.session?.id ?? null, actionableSaveId);
      setLoading(false);
    };

    void restoreActiveSession();
  }, [activeDraftSessionId, resolvedSaveId, saveId, setActiveDraftSessionId]);

  const handleDraftPlayer = async (player: PlayerRowDTO) => {
    const actionableSaveId = resolvedSaveId || saveId;
    if (!actionableSaveId || !activeDraftSessionId || !session || draftControlBusy) {
      return;
    }

    setDraftControlBusy(true);
    try {
      const currentPick = session.picks[session.currentPickIndex];
      const teamNeeds = getTeamNeeds(session.userTeamAbbr, teams);

      const response = await apiFetch(
        '/api/draft/pick',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saveId: actionableSaveId,
            draftSessionId: activeDraftSessionId,
            playerId: player.id,
            teamNeeds,
            sessionSnapshot: session,
            saveSnapshot: buildDraftSaveSnapshot(actionableSaveId),
          }),
        },
        { skipSaveGuard: true },
      );
      const payload = (await response.json()) as DraftPickResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.ok ? 'Unable to make pick.' : payload.error);
        return;
      }
      deferredSession.current = null;
      pausedRef.current = payload.session.isPaused;
      setSession(payload.session);
      if (session.mode === 'real') {
        setRoster(
          roster.some((entry) => entry.id === payload.draftedPlayer.id)
            ? roster.map((entry) =>
                entry.id === payload.draftedPlayer.id ? payload.draftedPlayer : entry,
              )
            : [...roster, payload.draftedPlayer],
        );
        await refreshSaveHeader(actionableSaveId);
      }
      const pick = payload.session.picks.find((entry) => entry.selectedPlayerId === player.id);
      const pickNumber = pick?.overall ?? currentPick?.overall ?? payload.session.currentPickIndex;

      setPickAnnouncementPlayer(payload.draftedPlayer);
      setPickAnnouncementGrade(payload.grade.letter);
      setPickAnnouncementOpen(true);
      window.setTimeout(() => setPickAnnouncementOpen(false), 1800);
      trackProgress(
        `draft-pick:${payload.draftedPlayer.id}:${pickNumber}`,
        OFFSEASON_PROGRESS_POINTS.draft.pick,
        `Submitted pick ${pickNumber} and added ${player.firstName} ${player.lastName}.`,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to make pick.');
    } finally {
      setDraftControlBusy(false);
    }
  };

  const handleDraftTradeAccepted = React.useCallback(
    ({
      nextSession,
      nextRoster,
      header,
    }: {
      nextSession: DraftSessionDTO;
      nextRoster: PlayerRowDTO[];
      header: {
        saveId: string;
        teamAbbr: string;
        year: number;
        capSpace: number;
        capLimit: number;
        rosterCount: number;
        rosterLimit: number;
        phase: string;
        unlocked: { freeAgency: boolean; draft: boolean };
        createdAt: string;
      };
    }) => {
      setSession(nextSession);
      setRoster(nextRoster);
      setSaveHeader(
        {
          ok: true,
          ...header,
        },
        teamId,
      );
    },
    [setRoster, setSaveHeader, teamId],
  );

  if (!(resolvedSaveId || saveId)) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Select a team to start a save.</p>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Let the {draftYear} Draft begin!</p>
        </div>
      </AppShell>
    );
  }

  const canContinueInFull = modeExperience !== 'full' || session?.status === 'completed';

  const handleContinue = () => {
    if (modeExperience !== 'full' || currentStep !== 'draft') return;
    if (saveId) {
      recordProgressEvent({
        saveId,
        step: 'draft',
        eventKey: 'continue:draft',
        complete: true,
      });
    }
    completeCurrentStep();
  };

  const handleSkip = () => {
    if (modeExperience !== 'full' || currentStep !== 'draft') return;
    if (saveId) {
      recordProgressEvent({
        saveId,
        step: 'draft',
        eventKey: 'skip:draft',
        complete: true,
        skipped: true,
      });
      pushToast({
        id: `progress:${saveId}:skip:draft`,
        kind: 'progress',
        durationMs: 3200,
        progress: {
          message: 'Completed the Draft step.',
          detail: 'Draft',
        },
      });
    }
    skipCurrentStep();
  };

  const handleContinueFromDraftRecap = async () => {
    if (!session || !draftRecap) {
      router.push('/offseason-recap');
      return;
    }

    const teamNeeds = getTeamNeeds(session.userTeamAbbr, teams);
    const needsAddressed = Array.from(
      new Set(
        draftRecap.entries
          .map((entry) => entry.player.position.toUpperCase())
          .filter((position) => teamNeeds.includes(position)),
      ),
    );
    const remainingNeeds = teamNeeds.filter((need) => !needsAddressed.includes(need));

    setLatestDraftRecap({
      teamName: userTeam?.name ?? session.userTeamAbbr,
      teamAbbr: session.userTeamAbbr,
      roundCount: session.maxRounds,
      overallGrade: draftRecap.summary.overallGrade,
      summaryLines: draftRecap.summary.summaryLines,
      needsAddressed,
      remainingNeeds,
      draftedPlayers: draftRecap.entries.map(({ pick, player, evaluation }) => ({
        id: player.id,
        name: `${player.firstName} ${player.lastName}`.trim(),
        position: player.position,
        school: player.college ?? player.school ?? null,
        pickOverall: pick.overall,
        pickRound: pick.round,
        grade: pick.grade ?? evaluation.grade,
        headshotUrl: player.headshotUrl ?? null,
        rating: player.rating ?? player.maddenRating ?? null,
      })),
    });
    if (session.mode === 'real') {
      try {
        await useSaveStore.getState().setPhase('week-1');
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unable to begin the next season.');
        return;
      }
    }
    setIsDraftRecapOpen(false);
    router.push(session.mode === 'real' ? '/front-office' : '/offseason-recap');
  };

  const simulateTo = async (kind: DraftSimulationTarget['kind']) => {
    if (!session || session.status !== 'in_progress' || draftControlBusy) return;
    if (kind === 'user_pick' || kind === 'next_pick') {
      setPrimarySimulationAction(kind);
      try {
        localStorage.setItem('dd-draft-primary-simulation', kind);
      } catch {
        /* In-memory preference remains available. */
      }
    }
    const round = session.picks[session.currentPickIndex]?.round ?? 1;
    setSimulationTarget(
      kind === 'next_pick' ? { kind, round, pickIndex: session.currentPickIndex } : { kind, round },
    );
    if (session.isPaused) await togglePause();
  };
  const finishSimulationTarget = () => {
    setSimulationTarget(null);
    if (
      simulationTarget?.kind === 'end_round' &&
      session?.status === 'in_progress' &&
      !session.isPaused
    )
      void togglePause();
  };

  return (
    <AppShell
      phaseControl={
        session?.status === 'in_progress' ? (
          <button
            className={styles.exitDraftButton}
            type="button"
            onClick={() => {
              setExitOpen(true);
              if (!session.isPaused) void togglePause();
            }}
          >
            ✕ Exit Mock Draft
          </button>
        ) : undefined
      }
    >
      {exitOpen && (
        <DraftDialog title="Exit Mock Draft?" onClose={() => setExitOpen(false)}>
          <p>
            Your current draft will remain paused. Return to this room to resume it. Your Front
            Office season will not advance.
          </p>
          <footer>
            <button type="button" onClick={() => setExitOpen(false)}>
              Cancel
            </button>
            <button type="button" disabled={draftControlBusy} onClick={() => router.push('/draft')}>
              Exit Draft
            </button>
          </footer>
        </DraftDialog>
      )}
      <DraftExperienceHero
        draftStatus={
          session?.status === 'in_progress'
            ? {
                paused: session.isPaused,
                round: session.picks[session.currentPickIndex]?.round ?? 1,
                pick: session.picks[session.currentPickIndex]?.overall ?? 1,
                team: session.picks[session.currentPickIndex]?.ownerTeamAbbr ?? '',
                clock:
                  clockDisplay?.pickId === session.picks[session.currentPickIndex]?.id
                    ? clockDisplay.text
                    : '—',
              }
            : undefined
        }
        compact={session?.status === 'in_progress'}
        title="Mock Draft Simulator"
        description="Make picks, explore trades, and build your team with real analysis."
        active="mock-draft"
        actions={
          <>
            <Link
              href={session?.status === 'in_progress' ? '#' : '/teams?switch=1'}
              onClick={(event) => {
                if (session?.status === 'in_progress') {
                  event.preventDefault();
                  setExitOpen(true);
                  if (!session.isPaused) void togglePause();
                }
              }}
              className={styles.teamSelector}
            >
              {selectedTeam?.logo_url ? (
                <Image src={selectedTeam.logo_url} alt="" width={34} height={34} />
              ) : null}
              <span>{selectedTeam?.name ?? 'Select team'}</span>
              <ChevronDown aria-hidden="true" />
            </Link>
            {session?.status === 'in_progress' ? (
              <div className={styles.simSplitButton}>
                <button
                  type="button"
                  disabled={
                    draftControlBusy || (primarySimulationAction === 'user_pick' && userOnClock)
                  }
                  onClick={() => void simulateTo(primarySimulationAction)}
                >
                  <span className={styles.fullSkipLabel}>
                    {primarySimulationAction === 'next_pick'
                      ? 'Skip to Next Pick'
                      : `Sim to ${userTeam?.name ?? session.userTeamAbbr} Pick`}
                  </span>
                  <span className={styles.shortSkipLabel} aria-hidden="true">
                    Skip
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={draftControlBusy}
                      aria-label="Simulation options"
                    >
                      <ChevronDown aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {primarySimulationAction === 'next_pick' ? (
                      <DropdownMenuItem
                        disabled={userOnClock}
                        onClick={() => void simulateTo('user_pick')}
                      >
                        Sim to {userTeam?.name ?? session.userTeamAbbr} Pick
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => void simulateTo('next_pick')}>
                        Skip to Next Pick
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => void simulateTo('end_round')}>
                      Sim to End of Round
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void simulateTo('end_draft')}>
                      Sim to End of Draft
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <button
                type="button"
                className={styles.settingsButton}
                onClick={() => setShowSettings((current) => !current)}
              >
                <Settings aria-hidden="true" /> Settings
              </button>
            )}
            {session?.status === 'in_progress' ? (
              <>
                <label className={styles.speedControl}>
                  <span>Speed:</span>{' '}
                  <select
                    aria-label="Draft speed"
                    value={speedLevel}
                    onChange={(event) =>
                      setSpeedLevel(Number(event.target.value) as DraftSpeedLevel)
                    }
                  >
                    <option value={0}>Normal</option>
                    <option value={1}>Fast</option>
                    <option value={2}>Instant</option>
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.pauseDraftButton}
                  disabled={draftControlBusy}
                  onClick={() => void togglePause()}
                >
                  {session.isPaused ? '▶ Resume Draft' : 'Ⅱ Pause Draft'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.startButton}
                disabled={draftControlBusy || Boolean(session)}
                onClick={() => setIsDraftSetupOpen(true)}
              >
                {session ? 'Draft Complete' : 'Start Mock Draft'} <ArrowRight aria-hidden="true" />
              </button>
            )}
          </>
        }
      />
      <PickAnnouncement
        open={pickAnnouncementOpen}
        team={userTeam}
        player={pickAnnouncementPlayer}
        grade={pickAnnouncementGrade}
      />
      {session?.status === 'completed' && draftRecap ? (
        <DraftRecapModal
          open={isDraftRecapOpen}
          teamName={userTeam?.name ?? session.userTeamAbbr}
          roundCount={session.maxRounds}
          teamNeeds={getTeamNeeds(session.userTeamAbbr, teams)}
          summary={draftRecap.summary}
          entries={draftRecap.entries}
          onContinue={handleContinueFromDraftRecap}
        />
      ) : null}
      <div className={styles.simulatorBody}>
        <div className="min-w-0">
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

          {!session ? (
            <div>
              {lobbyMessage ? (
                <p className="text-sm text-muted-foreground">{lobbyMessage}</p>
              ) : null}
              <PreDraftWorkspace
                onVisiblePlayersChange={setVisibleProfileIds}
                entries={lobbyBoardEntries}
                teams={teams}
                teamAbbr={teamAbbr || selectedTeam?.abbr || 'KC'}
                draftYear={draftYear}
                selectedPlayerId={selectedLobbyPlayerId}
                onSelectPlayer={setSelectedLobbyPlayerId}
                onOpenPlayer={() => setIsLobbyProspectModalOpen(true)}
              />
            </div>
          ) : session.status === 'completed' ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground">Draft Complete</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {mode === 'real'
                        ? `${session.maxRounds}-round class locked in. Review the recap to close the offseason.`
                        : `${session.maxRounds}-round mock complete. Review the recap to close the room.`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-slate-50 px-6 py-4 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Players Drafted
                    </p>
                    <p className="mt-2 text-3xl font-bold text-foreground">
                      {userSelections.length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center text-sm text-muted-foreground shadow-sm">
                Draft recap ready. Continue from the recap modal to view your offseason review.
              </div>
            </div>
          ) : (
            <ActiveDraftRoom
              onClockDisplayChange={setClockDisplay}
              saveId={resolvedSaveId || saveId}
              year={session.draftYear ?? draftYear}
              session={session}
              draftSessionId={session.id}
              saveSnapshot={buildDraftSaveSnapshot(resolvedSaveId || saveId)}
              teams={teams}
              falcoNotes={falcoBoard.notes}
              simulationTarget={simulationTarget}
              onSimulationTargetReached={finishSimulationTarget}
              speedLevel={speedLevel}
              showSettings={showSettings}
              draftView={draftView}
              isUserDraftModalOpen={pickAnnouncementOpen}
              isControlsBusy={draftControlBusy}
              onBackToBoard={() => setDraftView('board')}
              onSpeedChange={setSpeedLevel}
              onTogglePause={togglePause}
              onStartDraft={() => {
                void startDraft();
              }}
              onOfferTrade={() => setDraftView('trade')}
              onToggleSettings={() => setShowSettings((current) => !current)}
              onDraftPlayer={handleDraftPlayer}
              onDraftTradeAccepted={handleDraftTradeAccepted}
              onTradeBusyChange={setDraftControlBusy}
              onTradeUpdate={(next) => {
                deferredSession.current = null;
                pausedRef.current = next.isPaused;
                setSession((current) =>
                  current &&
                  ((current.tradeRevision ?? 0) > (next.tradeRevision ?? 0) ||
                    current.currentPickIndex > next.currentPickIndex)
                    ? current
                    : next,
                );
              }}
              onSessionUpdate={acceptSessionUpdate}
            />
          )}
        </div>
      </div>

      <FrontOfficeSupportingPanels mode="draft" />
      <ProspectDetailsModal
        open={isLobbyProspectModalOpen}
        player={selectedLobbyPlayer}
        players={visibleProfileIds.flatMap((id) => {
          const entry = lobbyBoardEntries.find((e) => e.player.id === id);
          return entry ? [entry.player] : [];
        })}
        year={draftYear}
        teamAbbr={teamAbbr ?? undefined}
        boardEntry={
          lobbyBoardEntries.find((entry) => entry.player.id === selectedLobbyPlayer?.id) ?? null
        }
        teamNeeds={getTeamNeeds(teamAbbr || selectedTeam?.abbr || 'KC', teams)}
        activeRuns={[]}
        onSelectPlayer={setSelectedLobbyPlayerId}
        onClose={() => setIsLobbyProspectModalOpen(false)}
      />
      {!session && (mode === 'mock' || isDraftWorkflowAvailable(phase)) && isDraftSetupOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 py-6 sm:items-center">
          <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Draft Setup
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Set the board</h2>

            <div className="mt-5 space-y-5 text-sm text-slate-700">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Draft Length
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((round) => {
                    const isSelected = pendingDraftRounds === round;
                    return (
                      <button
                        key={round}
                        type="button"
                        className={`min-h-10 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-border bg-white text-foreground hover:bg-slate-50'
                        }`}
                        onClick={() => setPendingDraftRounds(round)}
                      >
                        {round === 1 ? '1 Round' : `${round} Rounds`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Team Needs
                </p>
                <p className="mt-2">
                  {getTeamNeeds(teamAbbr || selectedTeam?.abbr || 'KC', teams)
                    .slice(0, 5)
                    .join(' · ')}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  if (!pendingDraftRounds) return;
                  setSelectedDraftRounds(pendingDraftRounds);
                  setIsDraftSetupOpen(false);
                  void startDraft(pendingDraftRounds);
                }}
                disabled={!pendingDraftRounds}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function DraftRoomPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DraftRoomContent />
    </Suspense>
  );
}
