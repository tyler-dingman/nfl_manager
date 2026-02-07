'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore, type Team } from '@/features/team/team-store';

type HypeCopy = {
  headline: string;
  message: string;
};

const HYPE_COPY: Record<string, HypeCopy> = {
  PHI: {
    headline: 'Fly Eagles Fly.',
    message: 'Time to improve the team for the City of Brotherly Love.',
  },
};

const TeamSelectCard = ({
  team,
  isSelected,
  onSelect,
}: {
  team: Team;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`group flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
      isSelected ? 'border-slate-900/30 ring-2 ring-slate-900/10' : 'border-border'
    }`}
  >
    <span
      className="h-full w-1.5 rounded-full"
      style={{ backgroundColor: team.color_primary ?? '#e2e8f0' }}
      aria-hidden="true"
    />
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border bg-slate-50">
      {team.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo_url}
          alt={`${team.name} logo`}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-xs font-semibold text-muted-foreground">{team.abbr}</span>
      )}
    </div>
    <div className="flex-1">
      <p className="text-sm font-semibold text-foreground">{team.name}</p>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{team.abbr}</p>
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
  </button>
);

function TeamSelectPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teams = useTeamStore((state) => state.teams);
  const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
  const saveId = useSaveStore((state) => state.saveId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const phase = useSaveStore((state) => state.phase);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const setActiveTeam = useSaveStore((state) => state.setActiveTeam);
  const clearSave = useSaveStore((state) => state.clearSave);

  const [activeTeam, setActiveTeamState] = useState<(typeof teams)[number] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preselectedTeamId, setPreselectedTeamId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const switchMode = searchParams?.get('switch') === '1';
    if (switchMode) {
      clearSave();
      return;
    }
    if (saveId || teamAbbr) {
      router.replace(
        phase === 'free_agency'
          ? '/free-agents'
          : phase === 'draft'
            ? '/draft/room?mode=mock'
            : '/roster',
      );
    }
  }, [clearSave, phase, router, saveId, searchParams, teamAbbr]);

  useEffect(() => {
    const teamParam = searchParams?.get('team')?.toUpperCase();
    if (!teamParam) {
      setPreselectedTeamId(null);
      return;
    }
    const match = teams.find((team) => team.abbr === teamParam);
    setPreselectedTeamId(match?.id ?? null);
  }, [searchParams, teams]);

  const filteredTeams = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return teams;
    }
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(trimmed) || team.abbr.toLowerCase().includes(trimmed),
    );
  }, [query, teams]);

  const handleSelectTeam = async (team: (typeof teams)[number]) => {
    setSelectedTeamId(team.id);
    setActiveTeam(team.id, team.abbr);

    const response = await fetch('/api/saves/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamAbbr: team.abbr }),
    });
    if (response.ok) {
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
            unlocked?: { freeAgency: boolean; draft: boolean };
            createdAt: string;
          }
        | { ok: false; error: string };
      if ('ok' in data && data.ok) {
        setSaveHeader(
          {
            ...data,
            unlocked: data.unlocked ?? { freeAgency: false, draft: false },
          },
          team.id,
        );
      }
    }

    setActiveTeamState(team);
    setIsModalOpen(true);
  };

  const hype = useMemo(() => {
    if (!activeTeam) return null;
    return (
      HYPE_COPY[activeTeam.abbr] ?? {
        headline: `Welcome to ${activeTeam.name}.`,
        message: `Time to build a contender in ${activeTeam.name}.`,
      }
    );
  }, [activeTeam]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
            Offseason Mode
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-foreground">Choose a team</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Choose a team to become the offseason GM and guide them through re-signings, free
            agency, and the draft.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Search
          </label>
          <input
            type="search"
            placeholder="Search teams..."
            className="h-10 rounded-md border border-border bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredTeams.map((team) => (
            <TeamSelectCard
              key={team.id}
              team={team}
              isSelected={team.id === preselectedTeamId}
              onSelect={() => handleSelectTeam(team)}
            />
          ))}
        </div>
      </div>

      {isModalOpen && activeTeam && hype ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Team ready</p>
            <h2 className="mt-3 text-2xl font-semibold text-foreground">{hype.headline}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{hype.message}</p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Re-sign</strong> /{' '}
                <strong className="text-foreground">cut</strong> /{' '}
                <strong className="text-foreground">trade</strong> players
              </p>
              <p>Then move into Free Agency</p>
              <p>Then the Draft</p>
              <p>Then 2026 season simulation (coming soon)</p>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => router.push('/roster')}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Start Offseason
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" aria-busy="true" />}>
      <TeamSelectPageInner />
    </Suspense>
  );
}
