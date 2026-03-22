'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { simulateSeasonRecap } from '@/lib/season-sim';
import type { TeamDTO } from '@/types/team';

export const dynamic = 'force-dynamic';

export default function SimSeasonPage() {
  const router = useRouter();
  const roster = useSaveStore((state) => state.roster);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const franchiseYear = useSaveStore((state) => state.franchiseYear);
  const startingOverall = useSaveStore((state) => state.startingOverall);
  const latestDraftRecap = useSaveStore((state) => state.latestDraftRecap);
  const latestSeasonRecap = useSaveStore((state) => state.latestSeasonRecap);
  const appendSeasonHistory = useSaveStore((state) => state.appendSeasonHistory);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const [isSimulating, setIsSimulating] = useState(false);

  const selectedTeam = useMemo(
    () =>
      teams.find((team) => team.id === selectedTeamId) ??
      teams.find((team) => team.abbr === teamAbbr) ??
      null,
    [selectedTeamId, teamAbbr, teams],
  );
  const teamDtos = useMemo<TeamDTO[]>(
    () =>
      teams.map((team) => ({
        id: team.id,
        abbr: team.abbr,
        name: team.name,
        logoUrl: team.logo_url,
        colors: [team.color_primary, team.color_secondary],
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
        allTeamNeeds: team.allTeamNeeds,
      })),
    [teams],
  );

  useEffect(() => {
    if (!teamAbbr || roster.length === 0) {
      router.replace('/offseason-recap');
      return;
    }

    if (latestSeasonRecap?.year === franchiseYear) {
      return;
    }

    setIsSimulating(true);
    const timer = window.setTimeout(() => {
      appendSeasonHistory(
        simulateSeasonRecap({
          year: franchiseYear,
          roster,
          teamAbbr,
          selectedTeam: selectedTeam
            ? {
                id: selectedTeam.id,
                abbr: selectedTeam.abbr,
                name: selectedTeam.name,
                logoUrl: selectedTeam.logo_url,
                colors: [selectedTeam.color_primary, selectedTeam.color_secondary],
                teamOverviewRaw: selectedTeam.teamOverviewRaw,
                offenseOverviewRaw: selectedTeam.offenseOverviewRaw,
                defenseOverviewRaw: selectedTeam.defenseOverviewRaw,
                specialTeamsOverviewRaw: selectedTeam.specialTeamsOverviewRaw,
                teamOverview: selectedTeam.teamOverview,
                offenseOverview: selectedTeam.offenseOverview,
                defenseOverview: selectedTeam.defenseOverview,
                specialTeamsOverview: selectedTeam.specialTeamsOverview,
                teamOverviewGrade: selectedTeam.teamOverviewGrade,
                teamNeeds: selectedTeam.teamNeeds,
                allTeamNeeds: selectedTeam.allTeamNeeds,
              }
            : null,
          teams: teamDtos,
          capSpace,
          capLimit,
          latestDraftRecap,
          startingOverall,
        }),
      );
      setIsSimulating(false);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [
    appendSeasonHistory,
    capLimit,
    capSpace,
    franchiseYear,
    latestDraftRecap,
    latestSeasonRecap?.year,
    roster,
    router,
    selectedTeam,
    startingOverall,
    teamAbbr,
    teamDtos,
  ]);

  const recap = latestSeasonRecap?.year === franchiseYear ? latestSeasonRecap : null;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-5 pb-16">
        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {franchiseYear} Season Simulation
          </p>
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">
                {selectedTeam?.name ?? 'Your Team'} season projection
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                A fast franchise-style sim based on the roster you built, the offseason ground you
                covered, and where the team now sits entering the year.
              </p>
            </div>
            {selectedTeam?.logo_url ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-slate-50">
                <Image
                  src={selectedTeam.logo_url}
                  alt={selectedTeam.name}
                  width={64}
                  height={64}
                  className="h-14 w-14 object-contain"
                  unoptimized
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          {isSimulating || !recap ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">
                  Running the {franchiseYear} season...
                </p>
                <p className="text-sm text-muted-foreground">
                  Projecting wins, playoff path, and who leads the way on both sides of the ball.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Final Record
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {recap.wins}-{recap.losses}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Division Finish
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {recap.divisionFinish}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Outcome
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {recap.seasonOutcome}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-slate-50 p-4">
                <p className="text-sm text-slate-700">{recap.summaryLines[0]}</p>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="h-11 w-full md:w-auto"
                  onClick={() => router.push('/season-recap')}
                >
                  View Season Recap
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
