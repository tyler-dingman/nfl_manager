'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import {
  buildOffseasonSummary,
  computeEndingTrajectory,
  computeLiveOverall,
  selectTopOffseasonAdditions,
} from '@/lib/offseason-recap';
import type { TeamDTO } from '@/types/team';

export const dynamic = 'force-dynamic';

export default function OffseasonRecapPage() {
  const router = useRouter();
  const roster = useSaveStore((state) => state.roster);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const franchiseYear = useSaveStore((state) => state.franchiseYear);
  const startingOverall = useSaveStore((state) => state.startingOverall);
  const startingTrajectory = useSaveStore((state) => state.startingTrajectory);
  const startingNeeds = useSaveStore((state) => state.startingNeeds);
  const latestDraftRecap = useSaveStore((state) => state.latestDraftRecap);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);

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
  const selectedTeamDto = useMemo<TeamDTO | null>(
    () =>
      selectedTeam
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
    [selectedTeam],
  );

  const endingOverall = useMemo(
    () =>
      computeLiveOverall({
        roster,
        teams: teamDtos,
        selectedTeam: selectedTeamDto,
      }),
    [roster, selectedTeamDto, teamDtos],
  );

  const endingTrajectory = useMemo(
    () =>
      computeEndingTrajectory({
        roster,
        overall: endingOverall,
        capSpace,
        capLimit,
      }),
    [capLimit, capSpace, endingOverall, roster],
  );

  const impactAdditions = useMemo(
    () =>
      selectTopOffseasonAdditions({
        roster,
        teamAbbr: teamAbbr || selectedTeam?.abbr || 'KC',
        teamNeeds: startingNeeds,
        latestDraftRecap,
      }),
    [latestDraftRecap, roster, selectedTeam?.abbr, startingNeeds, teamAbbr],
  );

  const overallDelta =
    startingOverall !== null && endingOverall !== null ? endingOverall - startingOverall : null;
  const needsAddressed = latestDraftRecap?.needsAddressed.length ?? 0;
  const summaryLines = buildOffseasonSummary({
    startingOverall,
    endingOverall,
    startingTrajectory: startingTrajectory ?? 'Balanced',
    endingTrajectory,
    capDelta: null,
    needsAddressed,
  });

  const signedCount = roster.filter(
    (player) => Boolean(player.signedAt) && player.signedTeamAbbr === teamAbbr,
  ).length;
  const tradedForCount = roster.filter(
    (player) =>
      player.currentTeamAbbr === teamAbbr &&
      Boolean(player.lastTeamAbbr) &&
      player.lastTeamAbbr !== teamAbbr &&
      !player.signedAt,
  ).length;
  const draftedCount = latestDraftRecap?.draftedPlayers.length ?? 0;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-16">
        <section className="rounded-3xl border border-border bg-white p-5 shadow-sm md:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {franchiseYear} Offseason Recap
          </p>
          <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">
                {selectedTeam?.name ?? 'Your Team'} ready for what is next
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                A clean look at how the roster changed, where the class landed, and which additions
                are most likely to matter right away.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                OVR Change
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {startingOverall ?? '—'} → {endingOverall ?? '—'}
                {overallDelta !== null ? ` (${overallDelta >= 0 ? '+' : ''}${overallDelta})` : ''}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Team Trajectory
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {startingTrajectory ?? 'Balanced'} → {endingTrajectory}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {summaryLines[0] ?? 'The roster pushed forward with a clearer direction.'}
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Draft Wrap
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {latestDraftRecap?.overallGrade ?? 'B'} overall class grade
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {latestDraftRecap?.summaryLines[0] ??
                'Your draft class added talent and flexibility to the roster.'}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Immediate Impact Additions
              </p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                Top 3 who can move the needle
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Signed {signedCount}</Badge>
              <Badge variant="outline">Traded For {tradedForCount}</Badge>
              <Badge variant="outline">Drafted {draftedCount}</Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {impactAdditions.length > 0 ? (
              impactAdditions.map((addition) => (
                <div
                  key={`${addition.acquisitionType}-${addition.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-3"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white">
                    {addition.headshotUrl ? (
                      <Image
                        src={addition.headshotUrl}
                        alt={addition.name}
                        width={56}
                        height={56}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {addition.name
                          .split(' ')
                          .slice(0, 2)
                          .map((part) => part.charAt(0))
                          .join('')}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {addition.name}
                      </p>
                      <Badge variant="secondary">{addition.position}</Badge>
                      <Badge variant="outline">{addition.acquisitionType}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{addition.note}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                No major additions were detected for this offseason recap yet.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Summary
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              {summaryLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Need Check
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Started With</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(startingNeeds.length > 0 ? startingNeeds : (selectedTeam?.teamNeeds ?? []))
                    .slice(0, 3)
                    .map((need) => (
                      <Badge key={`start-${need}`} variant="outline">
                        {need}
                      </Badge>
                    ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Addressed</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(latestDraftRecap?.needsAddressed ?? []).length > 0 ? (
                    latestDraftRecap?.needsAddressed.map((need) => (
                      <Badge key={`done-${need}`} variant="secondary">
                        {need}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No top needs directly addressed.
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Still On The Board</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(latestDraftRecap?.remainingNeeds ?? []).length > 0 ? (
                    latestDraftRecap?.remainingNeeds.map((need) => (
                      <Badge key={`left-${need}`} variant="outline">
                        {need}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Top needs were covered well.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <Button
            type="button"
            className="h-11 w-full md:w-auto"
            onClick={() => router.push('/sim-season')}
          >
            Sim Season
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
