'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { AdSlot } from '@/components/ads/AdSlot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import { computeTeamNeeds, computeTeamOverview } from '@/lib/team-overview';

type ExperienceMode = 'full' | 'freeAgency' | 'draft';

const EXPERIENCE_OPTIONS: Array<{
  key: ExperienceMode;
  title: string;
  description: string;
  isDefault?: boolean;
}> = [
  {
    key: 'full',
    title: 'Full Experience',
    description: 'Make tough decisions around your team to set it up for success.',
    isDefault: true,
  },
  {
    key: 'freeAgency',
    title: 'Free Agency',
    description: 'Sign free agents to improve your team.',
  },
  {
    key: 'draft',
    title: 'Draft',
    description: 'Draft the future of your team.',
  },
];

export default function ExperiencePage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const phase = useSaveStore((state) => state.phase);
  const hasHydrated = useSaveStore((state) => state.hasHydrated);
  const roster = useSaveStore((state) => state.roster);
  const setPhase = useSaveStore((state) => state.setPhase);
  const teams = useTeamStore((state) => state.teams);
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const experienceHasHydrated = useExperienceStore((state) => state.hasHydrated);
  const setFullExperience = useExperienceStore((state) => state.setFullExperience);
  const setSandboxExperience = useExperienceStore((state) => state.setSandboxExperience);

  const defaultMode = useMemo(() => 'full' as const, []);
  const [selectedMode, setSelectedMode] = useState<ExperienceMode>(defaultMode);

  const isHydrated = hasHydrated && experienceHasHydrated;
  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null,
    [selectedTeamId, teams],
  );
  const liveRosterPlayers = useMemo(
    () =>
      roster.filter(
        (player) =>
          player.status?.toLowerCase() !== 'cut' &&
          (!selectedTeam?.abbr || !player.teamAbbr || player.teamAbbr === selectedTeam.abbr),
      ),
    [roster, selectedTeam?.abbr],
  );
  const liveTeamPulse = useMemo(() => {
    if (liveRosterPlayers.length === 0) {
      return {
        overall: selectedTeam?.teamOverview ?? null,
        needs: selectedTeam?.teamNeeds ?? [],
      };
    }

    const overview = computeTeamOverview(liveRosterPlayers);
    const needs = computeTeamNeeds(liveRosterPlayers);
    return {
      overall: overview.overall,
      needs,
    };
  }, [liveRosterPlayers, selectedTeam?.teamNeeds, selectedTeam?.teamOverview]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!saveId) {
      router.replace('/');
    }
  }, [isHydrated, router, saveId]);

  if (!isHydrated || !saveId) {
    return <AppShell><div className="min-h-[1px]" /></AppShell>;
  }

  const handleContinue = async () => {
    if (selectedMode === 'full') {
      setFullExperience();
      if (phase !== 'resign_cut') {
        await setPhase('resign_cut');
      }
      router.push('/manage-team');
      return;
    }

    setSandboxExperience();

    if (selectedMode === 'freeAgency') {
      if (phase !== 'free_agency') {
        await setPhase('free_agency');
      }
      router.push('/free-agents');
      return;
    }

    if (phase !== 'draft') {
      await setPhase('draft');
    }
    router.push('/draft/room?mode=mock');
  };

  return (
    <AppShell>
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex w-full flex-col gap-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                Experience
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">
                Choose your experience
              </h1>
            </div>
            <div className="flex flex-col gap-1.5 text-left md:items-end md:text-right">
              <div className="flex items-baseline gap-2 md:justify-end">
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  OVR
                </span>
                <span
                  className="text-lg font-bold"
                  style={{ color: selectedTeam?.color_primary ?? 'var(--team-primary)' }}
                >
                  {liveTeamPulse.overall ?? '—'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 md:items-end">
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Team Needs
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                  {liveTeamPulse.needs.length > 0 ? liveTeamPulse.needs.join(' • ') : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {EXPERIENCE_OPTIONS.map((option) => {
              const isSelected = selectedMode === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`group flex h-full flex-col gap-3 rounded-2xl border bg-white p-4 text-left transition ${
                    isSelected
                      ? 'border-slate-900/30 ring-2 ring-slate-900/10'
                      : 'border-border hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                  onClick={() => setSelectedMode(option.key)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{option.title}</p>
                    {option.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </div>

        <div className="hidden w-full lg:block">
          <AdSlot placement="RIGHT_RAIL" sticky={false} />
        </div>
      </div>

      <AdSlot placement="ANCHOR" responsive={{ hideOnDesktop: true }} />
    </AppShell>
  );
}
