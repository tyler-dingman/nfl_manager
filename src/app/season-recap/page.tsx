'use client';

import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { apiFetch } from '@/lib/api';
import { approximateTrajectoryFromOverall } from '@/lib/offseason-recap';
import { computeFranchiseTrajectory } from '@/lib/franchise-trajectory';
import { computeTeamNeeds, computeTeamOverviewRaw, scaleOverviewScore } from '@/lib/team-overview';
import type { SaveBootstrapDTO } from '@/types/save';

export const dynamic = 'force-dynamic';

export default function SeasonRecapPage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const roster = useSaveStore((state) => state.roster);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const franchiseYear = useSaveStore((state) => state.franchiseYear);
  const latestSeasonRecap = useSaveStore((state) => state.latestSeasonRecap);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const setRoster = useSaveStore((state) => state.setRoster);
  const setRunBaseline = useSaveStore((state) => state.setRunBaseline);
  const setLatestDraftRecap = useSaveStore((state) => state.setLatestDraftRecap);
  const setFullExperience = useExperienceStore((state) => state.setFullExperience);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const [busy, setBusy] = useState(false);

  const selectedTeam =
    teams.find((team) => team.id === selectedTeamId) ??
    teams.find((team) => team.abbr === teamAbbr) ??
    null;

  const recap = latestSeasonRecap;

  const nextOffseasonLabel = `${franchiseYear + 1} Offseason`;
  const computeOverviewForRoster = useCallback(
    (targetRoster: typeof roster) => {
      const rawOverview = computeTeamOverviewRaw(targetRoster);
      const rawValues = teams
        .map((team) => team.teamOverviewRaw)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

      if (rawValues.length <= 1) {
        return selectedTeam?.teamOverview ?? null;
      }

      return scaleOverviewScore(
        rawOverview.overall,
        Math.min(...rawValues),
        Math.max(...rawValues),
        69,
        91,
      );
    },
    [selectedTeam?.teamOverview, teams],
  );

  const computedOverview = useMemo(
    () => computeOverviewForRoster(roster),
    [computeOverviewForRoster, roster],
  );

  if (!recap) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-border bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Season recap is not ready yet.</p>
          <Button type="button" className="mt-4" onClick={() => router.push('/sim-season')}>
            Back To Sim Season
          </Button>
        </div>
      </AppShell>
    );
  }

  const handleStartNextOffseason = async () => {
    if (!saveId || !selectedTeam) {
      router.push('/');
      return;
    }

    setBusy(true);
    const response = await apiFetch('/api/franchise/advance-offseason', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId }),
    });

    if (!response.ok) {
      setBusy(false);
      return;
    }

    const data = (await response.json()) as
      | (SaveBootstrapDTO & { roster: typeof roster })
      | { ok: false; error?: string };

    if ('ok' in data && !data.ok) {
      setBusy(false);
      return;
    }

    setSaveHeader(
      {
        ...data,
        unlocked: data.unlocked ?? { freeAgency: false, draft: false },
      },
      selectedTeam.id,
    );
    setRoster(data.roster);
    setLatestDraftRecap(null);

    const activeNextRoster = data.roster.filter((player) => player.status?.toLowerCase() !== 'cut');
    const nextNeeds = computeTeamNeeds(activeNextRoster);
    const nextOverall = computeOverviewForRoster(activeNextRoster);
    setRunBaseline({
      capSpace: data.capSpace,
      overall: nextOverall,
      trajectory: approximateTrajectoryFromOverall(nextOverall),
      needs: nextNeeds,
    });
    setFullExperience();
    setBusy(false);
    router.push('/roster');
  };

  const liveTrajectory = computeFranchiseTrajectory({
    roster,
    teamOverview: computedOverview,
    capSpace,
    capLimit,
  });

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-16">
        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {franchiseYear} Season Recap
          </p>
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">
                {recap.teamName} finish {recap.wins}-{recap.losses}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {recap.summaryLines[0]}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Playoff Result
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{recap.seasonOutcome}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Team Arc
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{liveTrajectory.state}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              OVR {computedOverview ?? '—'}
              {recap.overallDelta !== null
                ? ` (${recap.overallDelta >= 0 ? '+' : ''}${recap.overallDelta})`
                : ''}
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Division Finish
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{recap.divisionFinish}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {recap.playoffSeed
                ? `Playoff seed #${recap.playoffSeed}`
                : 'Outside the playoff bracket'}
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Top Notes
            </p>
            <div className="mt-2 space-y-2 text-sm text-muted-foreground">
              {recap.keyNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Team Leaders
              </p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                Who carried the production
              </h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {recap.leaders.map((leader) => (
              <div
                key={`${leader.category}-${leader.playerId}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-slate-50 px-4 py-3"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white">
                  {leader.headshotUrl ? (
                    <Image
                      src={leader.headshotUrl}
                      alt={leader.name}
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">
                      {leader.name
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part.charAt(0))
                        .join('')}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {leader.category}
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground">{leader.name}</p>
                </div>
                <Badge variant="secondary">{leader.valueLabel}</Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Immediate Impact Additions
              </p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                Offseason moves that showed up
              </h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {recap.impactAdditions.map((addition) => (
              <div
                key={`${addition.acquisitionType}-${addition.id}`}
                className="rounded-2xl border border-border bg-slate-50 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{addition.name}</p>
                  <Badge variant="secondary">{addition.position}</Badge>
                  <Badge variant="outline">{addition.acquisitionType}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{addition.note}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <Button
            type="button"
            className="h-11 w-full md:w-auto"
            disabled={busy}
            onClick={() => void handleStartNextOffseason()}
          >
            {busy ? `Starting ${nextOffseasonLabel}...` : `Start ${nextOffseasonLabel}`}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
