'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { ActiveDraftRoom, type DraftSpeedLevel } from '@/components/draft/active-draft-room';
import { DraftGradeModal } from '@/components/draft/draft-grade-modal';
import { DraftOrderPanel } from '@/components/draft/draft-order-panel';
import { DraftStagePanel } from '@/components/draft/draft-stage-panel';
import { buildRoundOneOrder } from '@/components/draft/draft-utils';
import { Button } from '@/components/ui/button';
import { useSaveStore } from '@/features/save/save-store';
import { getDraftGrade } from '@/lib/draft-utils';
import type { DraftMode, DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';

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
  ok: true;
  teams: Array<{ abbr: string; name: string; logoUrl: string; colors: string[] }>;
};

const formatName = (player: PlayerRowDTO) => `${player.firstName} ${player.lastName}`;

function DraftRoomContent() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const mode: DraftMode = modeParam === 'real' ? 'real' : 'mock';
  const [session, setSession] = React.useState<DraftSessionDTO | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [speedLevel, setSpeedLevel] = React.useState<DraftSpeedLevel>(1);
  const [gradeLetter, setGradeLetter] = React.useState<string | null>(null);
  const [gradeReason, setGradeReason] = React.useState<string | null>(null);
  const [isGradeOpen, setIsGradeOpen] = React.useState(false);
  const [teams, setTeams] = React.useState<TeamsResponse['teams']>([]);
  const [selectedPickNumber, setSelectedPickNumber] = React.useState(1);
  const [onTheClockPickNumber] = React.useState(1);
  const [lobbyMessage, setLobbyMessage] = React.useState('');

  const saveId = useSaveStore((state) => state.saveId);
  const teamId = useSaveStore((state) => state.teamId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const activeDraftSessionId = useSaveStore((state) => state.activeDraftSessionId);
  const setActiveDraftSessionId = useSaveStore((state) => state.setActiveDraftSessionId);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const refreshSaveHeader = useSaveStore((state) => state.refreshSaveHeader);

  const ensureSaveExists = React.useCallback(async () => {
    if (saveId) {
      const headerResponse = await fetch(`/api/saves/header?saveId=${saveId}`);
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
            }
          | { ok: false; error: string };
        if (headerData.ok) {
          setSaveHeader({ ...headerData, createdAt: new Date().toISOString() }, teamId);
          return headerData.saveId;
        }
      }
    }

    if (!teamAbbr && !teamId) {
      return null;
    }

    const response = await fetch('/api/saves/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, teamAbbr }),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as
      | {
          ok: true;
          saveId: string;
          teamAbbr: string;
          capSpace: number;
          capLimit: number;
          rosterCount: number;
          rosterLimit: number;
          phase: string;
        }
      | { ok: false; error: string };
    if (!data.ok) {
      return null;
    }

    setSaveHeader({ ...data, createdAt: new Date().toISOString() }, teamId);
    return data.saveId;
  }, [saveId, setSaveHeader, teamAbbr, teamId]);

  const userSelections = React.useMemo(() => {
    if (!session) {
      return [];
    }
    return session.picks
      .filter((pick) => pick.selectedByTeamAbbr === session.userTeamAbbr && pick.selectedPlayerId)
      .map((pick) => session.prospects.find((player) => player.id === pick.selectedPlayerId))
      .filter((player): player is PlayerRowDTO => Boolean(player));
  }, [session]);

  const roundOneOrder = React.useMemo(() => buildRoundOneOrder(teams), [teams]);

  const selectedPick = React.useMemo(
    () =>
      roundOneOrder.find((pick) => pick.pickNumber === selectedPickNumber) ??
      roundOneOrder[0] ??
      null,
    [roundOneOrder, selectedPickNumber],
  );

  const fetchSession = React.useCallback(
    async (draftSessionId: string) => {
      if (!saveId) {
        setError('Select a team to start a save.');
        return null;
      }
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ draftSessionId, saveId });
      const response = await fetch(`/api/draft/session?${query.toString()}`);
      const payload = (await response.json()) as DraftSessionResponse;
      if (!response.ok || !payload.ok) {
        const message = payload.ok ? 'Unable to load draft data.' : payload.error;
        // Clear draft session if save or session not found
        if (message === 'Draft session not found' || message === 'Save not found') {
          setActiveDraftSessionId(null, saveId);
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
    [saveId, setActiveDraftSessionId],
  );

  const startDraft = React.useCallback(async () => {
    const resolvedSaveId = await ensureSaveExists();
    if (!resolvedSaveId) {
      setError('Select a team to start a save.');
      return false;
    }
    setLoading(true);
    setError('');
    setLobbyMessage('');
    const response = await fetch('/api/draft/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId: resolvedSaveId, mode }),
    });
    const payload = (await response.json()) as DraftSessionStartResponse;
    if (!response.ok || !payload.ok) {
      setLobbyMessage(payload.ok ? 'Unable to start draft.' : payload.error);
      setLoading(false);
      return false;
    }
    setActiveDraftSessionId(payload.draftSessionId, resolvedSaveId);
    if (payload.session) {
      setSession(payload.session);
    } else {
      await fetchSession(payload.draftSessionId);
    }
    setLoading(false);
    return true;
  }, [ensureSaveExists, fetchSession, mode, setActiveDraftSessionId]);

  const setPaused = React.useCallback(
    async (isPaused: boolean) => {
      if (!saveId || !activeDraftSessionId) {
        return;
      }
      const response = await fetch('/api/draft/session/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saveId, draftSessionId: activeDraftSessionId, isPaused }),
      });
      const payload = (await response.json()) as DraftSessionResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.ok ? 'Unable to update pause state' : payload.error);
        return;
      }
      setSession(payload.session);
    },
    [activeDraftSessionId, saveId],
  );

  React.useEffect(() => {
    if (activeDraftSessionId) {
      void fetchSession(activeDraftSessionId);
    }
  }, [activeDraftSessionId, fetchSession]);

  React.useEffect(() => {
    const loadTeams = async () => {
      const response = await fetch('/api/teams');
      const payload = (await response.json()) as TeamsResponse;
      if (!response.ok || !payload.ok) {
        return;
      }
      setTeams(payload.teams);
    };

    void loadTeams();
  }, []);

  React.useEffect(() => {
    if (!saveId || activeDraftSessionId) {
      return;
    }

    const restoreActiveSession = async () => {
      setLoading(true);
      setError('');
      const query = new URLSearchParams({ saveId });
      const response = await fetch(`/api/draft/session/active?${query.toString()}`);
      const payload = (await response.json()) as ActiveDraftSessionResponse;
      if (!response.ok || !payload.ok) {
        setLoading(false);
        setSession(null);
        setError('');
        return;
      }

      setSession(payload.session);
      setActiveDraftSessionId(payload.session?.id ?? null, saveId);
      setLoading(false);
    };

    void restoreActiveSession();
  }, [activeDraftSessionId, saveId, setActiveDraftSessionId]);

  const handleDraftPlayer = async (player: PlayerRowDTO) => {
    if (!saveId || !activeDraftSessionId || !session) {
      return;
    }

    const response = await fetch('/api/draft/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId, draftSessionId: activeDraftSessionId, playerId: player.id }),
    });
    const payload = (await response.json()) as DraftPickResponse;
    if (!response.ok || !payload.ok) {
      setError(payload.ok ? 'Unable to make pick.' : payload.error);
      return;
    }
    setSession(payload.session);
    await refreshSaveHeader();
    setGradeLetter(payload.grade.letter);
    setGradeReason(payload.grade.reason);
    setIsGradeOpen(true);
  };

  if (!saveId) {
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

  return (
    <AppShell>
      <DraftGradeModal
        isOpen={isGradeOpen}
        gradeLetter={gradeLetter}
        reason={gradeReason}
        onClose={() => setIsGradeOpen(false)}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Draft Room</h1>
          <p className="text-sm text-muted-foreground">
            Mode: {mode === 'real' ? 'Real Draft' : 'Mock Draft'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!session ? (
            <Button type="button" onClick={startDraft}>
              Start Draft
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {!session ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          {selectedPick ? (
            <div className="order-2 lg:order-1">
              <DraftOrderPanel
                picks={roundOneOrder}
                selectedPickNumber={selectedPickNumber}
                onTheClockPickNumber={onTheClockPickNumber}
                onSelectPick={setSelectedPickNumber}
              />
            </div>
          ) : null}
          {selectedPick ? (
            <div className="order-1 lg:order-2">
              <DraftStagePanel
                selectedPick={selectedPick}
                onTheClockPickNumber={onTheClockPickNumber}
                onStartDraft={() => void startDraft()}
                isStartingDraft={loading}
              />
              {lobbyMessage ? (
                <p className="mt-3 text-sm text-muted-foreground">{lobbyMessage}</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
              <p className="text-sm text-muted-foreground">Loading draft order...</p>
            </div>
          )}
        </div>
      ) : session.status === 'completed' ? (
        <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Draft Complete</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === 'real' ? 'Draft results saved to your roster.' : 'Mock draft finalized.'}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 px-6 py-4 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Draft Grade
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {getDraftGrade(userSelections.map((player) => player.rank ?? 100))}
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {userSelections.map((player) => (
              <div
                key={player.id}
                className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-sm font-semibold text-foreground">{formatName(player)}</p>
                <p className="text-xs text-muted-foreground">
                  {player.position} · Rank {player.rank ?? '--'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ActiveDraftRoom
          session={session}
          saveId={saveId}
          draftSessionId={session.id}
          teams={teams}
          speedLevel={speedLevel}
          onSpeedChange={setSpeedLevel}
          onTogglePause={() => void setPaused(!session.isPaused)}
          onDraftPlayer={handleDraftPlayer}
          onSessionUpdate={setSession}
        />
      )}
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
