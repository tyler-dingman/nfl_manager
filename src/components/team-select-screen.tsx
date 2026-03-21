'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

import { FiveWideLogo } from '@/components/branding/fivewide-logo';
import { FiveWideWordmark } from '@/components/branding/fivewide-wordmark';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore, type Team } from '@/features/team/team-store';
import { apiFetch } from '@/lib/api';
import { approximateTrajectoryFromOverall } from '@/lib/offseason-recap';
import type { SaveBootstrapDTO } from '@/types/save';
import type { TeamDTO } from '@/types/team';

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
    className={`group flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
      isSelected ? 'border-slate-900/30 ring-2 ring-slate-900/10' : 'border-border'
    }`}
  >
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-slate-50">
      {team.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo_url}
          alt={`${team.name} logo`}
          className="h-9 w-9 object-contain"
        />
      ) : (
        <span className="text-xs font-semibold text-muted-foreground">{team.abbr}</span>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-snug text-foreground">{team.name}</p>
        <div className="shrink-0 text-right">
          <span style={{ color: team.color_primary }} className="text-[15px] font-bold leading-none">
            {team.teamOverview}
          </span>
        </div>
      </div>
      <div className="mt-2 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
          Needs:
        </div>
        <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
          {team.teamNeeds.join(' • ')}
        </span>
      </div>
    </div>
  </button>
);

function TeamSelectScreenInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teams = useTeamStore((state) => state.teams);
  const setTeams = useTeamStore((state) => state.setTeams);
  const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const setRunBaseline = useSaveStore((state) => state.setRunBaseline);
  const setActiveTeam = useSaveStore((state) => state.setActiveTeam);
  const clearSave = useSaveStore((state) => state.clearSave);
  const resetForNewRun = useExperienceStore((state) => state.resetForNewRun);

  const [preselectedTeamId, setPreselectedTeamId] = useState<string | null>(null);
  const [showExpiredBanner, setShowExpiredBanner] = useState(false);

  useEffect(() => {
    const loadTeams = async () => {
      const response = await apiFetch('/api/teams');
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as TeamDTO[];
      setTeams(
        payload.map((team) => ({
          id: team.id,
          name: team.name,
          abbr: team.abbr,
          logo_url: team.logoUrl,
          color_primary: team.colors[0] ?? '#013369',
          color_secondary: team.colors[1] ?? '#D50A0A',
          teamOverviewRaw: team.teamOverviewRaw,
          offenseOverviewRaw: team.offenseOverviewRaw,
          defenseOverviewRaw: team.defenseOverviewRaw,
          specialTeamsOverviewRaw: team.specialTeamsOverviewRaw,
          teamOverview: team.teamOverview,
          offenseOverview: team.offenseOverview,
          defenseOverview: team.defenseOverview,
          specialTeamsOverview: team.specialTeamsOverview,
          teamOverviewGrade: team.teamOverviewGrade,
          teamNeeds: team.teamNeeds,
        })),
      );
    };

    void loadTeams();
  }, [setTeams]);

  useEffect(() => {
    const teamParam = searchParams?.get('team')?.toUpperCase();
    if (!teamParam) {
      setPreselectedTeamId(null);
      return;
    }
    const match = teams.find((team) => team.abbr === teamParam);
    setPreselectedTeamId(match?.id ?? null);
  }, [searchParams, teams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flag = localStorage.getItem('falco_save_expired');
    if (flag) {
      setShowExpiredBanner(true);
      localStorage.removeItem('falco_save_expired');
    }
  }, []);

  const filteredTeams = useMemo(() => teams, [teams]);

  const handleSelectTeam = async (team: (typeof teams)[number]) => {
    clearSave();
    resetForNewRun();
    setSelectedTeamId(team.id);
    setActiveTeam(team.id, team.abbr);

    const response = await apiFetch('/api/saves/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamAbbr: team.abbr }),
    });
    if (response.ok) {
      const data = (await response.json()) as
        | (SaveBootstrapDTO & { unlocked?: SaveBootstrapDTO['unlocked'] })
        | { ok: false; error: string };
      if ('ok' in data && data.ok) {
        setSaveHeader(
          {
            ...data,
            unlocked: data.unlocked ?? { freeAgency: false, draft: false },
          },
          team.id,
        );
        setRunBaseline({
          capSpace: data.capSpace,
          overall: team.teamOverview ?? null,
          trajectory: approximateTrajectoryFromOverall(team.teamOverview ?? null),
          needs: team.teamNeeds,
        });
      }
    }

    router.push('/experience');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-3">
            <FiveWideLogo size={24} containerClassName="h-10 w-10 shrink-0" priority />
            <div className="leading-none">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                Offseason Mode
              </p>
              <FiveWideWordmark className="mt-1 h-[15px]" priority />
            </div>
          </div>
          <div>
            <h1 className="mt-3 text-3xl font-semibold text-foreground">Choose a Team</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Second chances start in the offseason. Choose a team to become the offseason GM—manage
              the cap, re-sign or cut players, then move into free agency and the draft.
            </p>
          </div>
        </div>

        {showExpiredBanner ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your offseason session expired. Start a new run.
          </div>
        ) : null}

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
    </div>
  );
}

export default function TeamSelectScreen() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" aria-busy="true" />}>
      <TeamSelectScreenInner />
    </Suspense>
  );
}
