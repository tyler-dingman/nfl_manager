'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, ClipboardList, PlayCircle, Scissors, UserPlus, X } from 'lucide-react';

import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore, type Team } from '@/features/team/team-store';
import { Badge } from '@/components/ui/badge';
import { getReadableTextColor } from '@/lib/color-utils';

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
  const hasHydrated = useSaveStore((state) => state.hasHydrated);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const setActiveTeam = useSaveStore((state) => state.setActiveTeam);
  const clearSave = useSaveStore((state) => state.clearSave);

  const [activeTeam, setActiveTeamState] = useState<(typeof teams)[number] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preselectedTeamId, setPreselectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    const switchMode = searchParams?.get('switch') === '1';
    if (switchMode) {
      clearSave();
      return;
    }
    if (hasHydrated && (saveId || teamAbbr)) {
      router.replace(
        phase === 'free_agency'
          ? '/free-agents'
          : phase === 'draft'
            ? '/draft/room?mode=mock'
            : '/roster',
      );
    }
  }, [clearSave, hasHydrated, phase, router, saveId, searchParams, teamAbbr]);

  useEffect(() => {
    const teamParam = searchParams?.get('team')?.toUpperCase();
    if (!teamParam) {
      setPreselectedTeamId(null);
      return;
    }
    const match = teams.find((team) => team.abbr === teamParam);
    setPreselectedTeamId(match?.id ?? null);
  }, [searchParams, teams]);

  const filteredTeams = useMemo(() => teams, [teams]);

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

  const steps = useMemo(
    () => [
      {
        title: 'Re-sign / cut / trade players',
        description: 'Get under the cap and reshape the roster.',
        icon: Scissors,
        stepLabel: 'Step 1',
        active: true,
      },
      {
        title: 'Free Agency',
        description: 'Fill roster holes with smart signings.',
        icon: UserPlus,
        stepLabel: 'Step 2',
      },
      {
        title: 'Draft',
        description: 'Add young talent and build for the future.',
        icon: ClipboardList,
        stepLabel: 'Step 3',
      },
      {
        title: '2026 season simulation',
        description: 'See how your offseason moves perform.',
        icon: PlayCircle,
        stepLabel: 'Step 4',
        comingSoon: true,
      },
    ],
    [],
  );

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
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Team Ready
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-foreground">{hype.headline}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{hype.message}</p>

            <div className="mt-5 space-y-3">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                      step.active ? 'border-slate-900/30 bg-slate-50' : 'border-border bg-white'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                        step.active ? 'border-slate-900/30 bg-white' : 'border-border bg-slate-50'
                      }`}
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                      {step.comingSoon ? (
                        <Badge variant="secondary" className="mt-2">
                          Coming soon
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {step.stepLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  router.push('/roster');
                }}
                className="rounded-full px-4 py-2 text-sm font-semibold transition"
                style={{
                  backgroundColor: activeTeam.color_primary ?? '#111827',
                  color: getReadableTextColor(activeTeam.color_primary ?? '#111827'),
                }}
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
