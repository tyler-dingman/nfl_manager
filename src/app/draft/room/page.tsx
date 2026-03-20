'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { DraftTrackerRibbon } from '@/components/draft/draft-tracker-ribbon';
import { StepHeader } from '@/components/offseason/step-header';
import { ActiveDraftRoom, type DraftSpeedLevel } from '@/components/draft/active-draft-room';
import { DraftGradeModal } from '@/components/draft/draft-grade-modal';
import { DraftRecap } from '@/components/draft/draft-recap';
import { LiveDraftBoard } from '@/components/draft/live-draft-board';
import { PickAnnouncement } from '@/components/draft/pick-announcement';
import { ProspectDetailsModal } from '@/components/draft/prospect-details-modal';
import { buildRoundOneOrder, getTeamNeeds } from '@/components/draft/draft-utils';
import { useToast } from '@/components/ui/toast';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { OFFSEASON_STEPS } from '@/features/experience/offseason-steps';
import { getRouteForStep, isStepUnlocked } from '@/features/experience/experience-utils';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { rankDraftBoard } from '@/lib/draft-board';
import {
  detectActiveDraftRuns,
  evaluateDraftPick,
  summarizeDraftClass,
} from '@/lib/draft-intelligence';
import { OFFSEASON_PROGRESS_POINTS } from '@/lib/offseason-progress';
import { buildFalcoBoard } from '@/lib/falco';
import { getTeamReactionLine } from '@/lib/team-flavor';
import { apiFetch } from '@/lib/api';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';
import { buildTop32Prospects } from '@/server/data/prospects-top32';
import type { DraftMode, DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';

export const dynamic = 'force-dynamic';

type DraftSessionResponse = { ok: true; session: DraftSessionDTO } | { ok: false; error: string };

type DraftPickResponse =
  | {
      ok: true;
      session: DraftSessionDTO;
      grade: { letter: string; reason: string };
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

function DraftRoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modeParam = searchParams?.get('mode');
  const mode: DraftMode = modeParam === 'real' ? 'real' : 'mock';
  const [session, setSession] = React.useState<DraftSessionDTO | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [speedLevel, setSpeedLevel] = React.useState<DraftSpeedLevel>(1);
  const [draftView, setDraftView] = React.useState<'board' | 'trade'>('board');
  const [gradeLetter, setGradeLetter] = React.useState<string | null>(null);
  const [draftedPlayerName, setDraftedPlayerName] = React.useState<string | null>(null);
  const [draftedPlayerMeta, setDraftedPlayerMeta] = React.useState<string | null>(null);
  const [teamMessage, setTeamMessage] = React.useState<string | null>(null);
  const [gradeReasons, setGradeReasons] = React.useState<string[]>([]);
  const [isGradeOpen, setIsGradeOpen] = React.useState(false);
  const [teams, setTeams] = React.useState<TeamsResponse['teams']>([]);
  const [selectedPickNumber] = React.useState(1);
  const [lobbyMessage, setLobbyMessage] = React.useState('');
  const [showSettings, setShowSettings] = React.useState(false);
  const [pickAnnouncementPlayer, setPickAnnouncementPlayer] = React.useState<PlayerRowDTO | null>(null);
  const [pickAnnouncementOpen, setPickAnnouncementOpen] = React.useState(false);
  const [selectedLobbyPlayerId, setSelectedLobbyPlayerId] = React.useState<string | null>(null);
  const [isLobbyProspectModalOpen, setIsLobbyProspectModalOpen] = React.useState(false);
  const [draftControlBusy, setDraftControlBusy] = React.useState(false);

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
  const falcoSeed = `${saveId ?? 'global'}-${session?.id ?? 'lobby'}`;
  const falcoBoard = React.useMemo(
    () => buildFalcoBoard(session?.prospects ?? buildTop32Prospects(), falcoSeed),
    [falcoSeed, session?.prospects],
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
    setIsUserOnClock(userOnClock);
  }, [setIsUserOnClock, userOnClock]);

  React.useEffect(() => {
    return () => setIsUserOnClock(false);
  }, [setIsUserOnClock]);

  React.useEffect(() => {
    if (modeExperience === 'full' && !isStepUnlocked('draft', currentStep)) {
      router.replace(getRouteForStep(currentStep));
    }
  }, [modeExperience, currentStep, router]);

  React.useEffect(() => {
    if (modeExperience !== 'full') return;
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
  }, [modeExperience, session?.status, completedSteps, completeCurrentStep, recordProgressEvent, saveId]);

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
        const headerResponse = await apiFetch(`/api/saves/header?${headerParams.toString()}`, undefined, {
          skipSaveGuard: true,
        });
        if (headerResponse.ok) {
          const headerData = (await headerResponse.json()) as
            | {
                ok: true;
                saveId: string;
                teamAbbr: string;
                capSpace: number;
                capLimit: number;
                rosterCount: number;
                rosterLimit: number;
                phase: string;
                unlocked?: { freeAgency: boolean; draft: boolean };
              }
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
  const lobbyProspects = React.useMemo(() => buildTop32Prospects(), []);

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
      : null) ?? lobbyBoardEntries[0]?.player ?? null;

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
      teamAbbr: teamAbbr || selectedTeam?.abbr || null,
      capSpace,
      capLimit,
      roster,
      phase: 'draft',
      unlocked: {
        freeAgency: true,
        draft: true,
      },
    }),
    [capLimit, capSpace, roster, selectedTeam?.abbr, teamAbbr],
  );

  const syncDraftPhase = React.useCallback(
    async (activeSaveId: string) => {
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
        | {
            ok: true;
            saveId: string;
            teamAbbr: string;
            capSpace: number;
            capLimit: number;
            rosterCount: number;
            rosterLimit: number;
            phase: string;
            unlocked?: { freeAgency: boolean; draft: boolean };
            createdAt: string;
          }
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
    [buildDraftSaveSnapshot, setSaveHeader, teamId],
  );

  const startDraft = React.useCallback(async () => {
    if (draftControlBusy) {
      return false;
    }

    setDraftControlBusy(true);
    setLoading(true);
    setError('');
    setLobbyMessage('');
    setDraftView('board');

    try {
      const activeSaveId = await ensureSaveExists('draft');
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
          const freshSaveId = await ensureSaveExists('draft');
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
  }, [
    draftControlBusy,
    ensureSaveExists,
    fetchSession,
    mode,
    setActiveDraftSessionId,
    buildDraftSaveSnapshot,
    syncDraftPhase,
  ]);

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
          }),
        },
        { skipSaveGuard: true },
      );
      const payload = (await response.json()) as DraftSessionResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.ok ? 'Unable to update pause state' : payload.error);
        return;
      }
      setSession(payload.session);
    } finally {
      setDraftControlBusy(false);
    }
  }, [activeDraftSessionId, draftControlBusy, resolvedSaveId, saveId, session]);

  React.useEffect(() => {
    if (activeDraftSessionId) {
      void fetchSession(activeDraftSessionId, resolvedSaveId || saveId);
    }
  }, [activeDraftSessionId, fetchSession, resolvedSaveId, saveId]);

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
    if (!actionableSaveId || !activeDraftSessionId || !session) {
      return;
    }

    const currentPick = session.picks[session.currentPickIndex];
    const teamNeeds = getTeamNeeds(session.userTeamAbbr, teams);
    const boardEntries = rankDraftBoard({
      prospects: session.prospects,
      teamNeeds,
      currentPickOverall: currentPick?.overall ?? session.currentPickIndex + 1,
      limit: 24,
    });
    const boardEntry = boardEntries.find((entry) => entry.player.id === player.id) ?? null;
    const activeRuns = detectActiveDraftRuns(session.picks, session.prospects);

    const response = await apiFetch(
      '/api/draft/pick',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveId: actionableSaveId,
          draftSessionId: activeDraftSessionId,
          playerId: player.id,
        }),
      },
      { skipSaveGuard: true },
    );
    const payload = (await response.json()) as DraftPickResponse;
    if (!response.ok || !payload.ok) {
      setError(payload.ok ? 'Unable to make pick.' : payload.error);
      return;
    }
    setSession(payload.session);
    setRoster(
      roster.some((entry) => entry.id === payload.draftedPlayer.id)
        ? roster.map((entry) => (entry.id === payload.draftedPlayer.id ? payload.draftedPlayer : entry))
        : [...roster, payload.draftedPlayer],
    );
    await refreshSaveHeader();
    const pick = payload.session.picks.find((entry) => entry.selectedPlayerId === player.id);
    const pickNumber = pick?.overall ?? currentPick?.overall ?? payload.session.currentPickIndex;
    const evaluation = evaluateDraftPick({
      player,
      currentPickOverall: pickNumber,
      teamNeeds,
      boardEntry,
      activeRuns,
    });

    setGradeLetter(evaluation.grade);
    setDraftedPlayerName(`${player.firstName} ${player.lastName}`);
    setDraftedPlayerMeta(`${player.position} · ${player.college ?? '—'}`);
    setTeamMessage(
      getTeamReactionLine(payload.session.userTeamAbbr, 'celebratory', {
        seed: `${payload.session.id}:${player.id}:${pickNumber}`,
      }),
    );
    setGradeReasons(evaluation.reasons);
    setPickAnnouncementPlayer(payload.draftedPlayer);
    setPickAnnouncementOpen(true);
    window.setTimeout(() => setPickAnnouncementOpen(false), 1800);
    setIsGradeOpen(true);
    trackProgress(
      `draft-pick:${payload.draftedPlayer.id}:${pickNumber}`,
      OFFSEASON_PROGRESS_POINTS.draft.pick,
      `Submitted pick ${pickNumber} and added ${player.firstName} ${player.lastName}.`,
    );
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
          <p className="text-sm text-muted-foreground">Loading draft room...</p>
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

  return (
    <AppShell>
      {modeExperience === 'full' ? (
        <StepHeader
          title="Draft"
          stepNumber={3}
          totalSteps={OFFSEASON_STEPS.length}
          instruction="Complete your draft to finish the offseason journey."
          canContinue={canContinueInFull}
          continueLabel="Finish Offseason"
          onContinue={handleContinue}
          onSkip={handleSkip}
        />
      ) : null}
      <DraftGradeModal
        isOpen={isGradeOpen}
        gradeLetter={gradeLetter}
        gradeLabel="Draft IQ"
        playerName={draftedPlayerName}
        playerMeta={draftedPlayerMeta}
        teamName={userTeam?.name ?? session?.userTeamAbbr ?? 'Your team'}
        teamLogoUrl={userTeam?.logoUrl}
        teamMessage={teamMessage}
        reasons={gradeReasons}
        onClose={() => setIsGradeOpen(false)}
      />
      <PickAnnouncement open={pickAnnouncementOpen} team={userTeam} player={pickAnnouncementPlayer} />
      <div className="space-y-6">
        <div className="min-w-0">
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

          {!session ? (
            <div className="space-y-5">
              <DraftTrackerRibbon
                picks={roundOneOrder.map((pick) => ({
                  id: `lobby-${pick.pickNumber}`,
                  overall: pick.pickNumber,
                  round: 1,
                  ownerTeamAbbr: pick.abbr,
                  originalTeamAbbr: pick.abbr,
                  selectedPlayerId: null,
                  selectedByTeamAbbr: null,
                }))}
                currentPickIndex={0}
                prospects={lobbyProspects}
                teams={teams}
                userTeamAbbr={teamAbbr || selectedTeam?.abbr || 'KC'}
                controls={{
                  speedLevel,
                  showSettings,
                  hasStarted: false,
                  isBusy: draftControlBusy,
                  onSpeedChange: setSpeedLevel,
                  onTogglePause: togglePause,
                  onStartDraft: () => {
                    void startDraft();
                  },
                  onToggleSettings: () => setShowSettings((current) => !current),
                }}
              />

              {lobbyMessage ? <p className="text-sm text-muted-foreground">{lobbyMessage}</p> : null}

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <LiveDraftBoard
                  entries={lobbyBoardEntries}
                  teamNeeds={getTeamNeeds(teamAbbr || selectedTeam?.abbr || 'KC', teams)}
                  activeRuns={[]}
                  onInspectPlayer={(playerId) => {
                    setSelectedLobbyPlayerId(playerId);
                    setIsLobbyProspectModalOpen(true);
                  }}
                  canDraft={false}
                />

                <aside className="space-y-5">
                  <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      War Room Setup
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-foreground">Set the board</h2>
                    <div className="mt-4 space-y-4 text-sm text-slate-700">
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
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          First Pick
                        </p>
                        <p className="mt-2">
                          {selectedPick ? `Pick ${selectedPick.pickNumber} · ${selectedPick.name}` : 'Loading draft order'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Room Note
                        </p>
                        <p className="mt-2">
                          Premium positions and clean value should stay on your radar early. Let the board come to you.
                        </p>
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          ) : session.status === 'completed' ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground">Draft Complete</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {mode === 'real'
                        ? 'Draft results saved to your roster.'
                        : 'Mock draft finalized.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-slate-50 px-6 py-4 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Players Drafted
                    </p>
                    <p className="mt-2 text-3xl font-bold text-foreground">{userSelections.length}</p>
                  </div>
                </div>
              </div>

              {draftRecap ? <DraftRecap summary={draftRecap.summary} entries={draftRecap.entries} /> : null}
            </div>
          ) : (
            <ActiveDraftRoom
              saveId={resolvedSaveId || saveId}
              session={session}
              draftSessionId={session.id}
              teams={teams}
              falcoNotes={falcoBoard.notes}
              speedLevel={speedLevel}
              showSettings={showSettings}
              draftView={draftView}
              isUserDraftModalOpen={isGradeOpen}
              isControlsBusy={draftControlBusy}
              onBackToBoard={() => setDraftView('board')}
              onSpeedChange={setSpeedLevel}
              onTogglePause={togglePause}
              onStartDraft={() => {
                void startDraft();
              }}
              onToggleSettings={() => setShowSettings((current) => !current)}
              onDraftPlayer={handleDraftPlayer}
              onDraftTradeAccepted={handleDraftTradeAccepted}
              onSessionUpdate={setSession}
            />
          )}
        </div>
      </div>

      <ProspectDetailsModal
        open={isLobbyProspectModalOpen}
        player={selectedLobbyPlayer}
        boardEntry={lobbyBoardEntries.find((entry) => entry.player.id === selectedLobbyPlayer?.id) ?? null}
        teamNeeds={getTeamNeeds(teamAbbr || selectedTeam?.abbr || 'KC', teams)}
        activeRuns={[]}
        onClose={() => setIsLobbyProspectModalOpen(false)}
      />
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
