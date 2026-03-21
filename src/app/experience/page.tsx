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
import { getReadableTextColor } from '@/lib/color-utils';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';

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
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const teamId = useSaveStore((state) => state.teamId);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const roster = useSaveStore((state) => state.roster);
  const phase = useSaveStore((state) => state.phase);
  const unlocked = useSaveStore((state) => state.unlocked);
  const hasHydrated = useSaveStore((state) => state.hasHydrated);
  const setPhase = useSaveStore((state) => state.setPhase);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const teams = useTeamStore((state) => state.teams);
  const experienceHasHydrated = useExperienceStore((state) => state.hasHydrated);
  const setFullExperience = useExperienceStore((state) => state.setFullExperience);
  const setSandboxExperience = useExperienceStore((state) => state.setSandboxExperience);

  const defaultMode = useMemo(() => 'full' as const, []);
  const [selectedMode, setSelectedMode] = useState<ExperienceMode>(defaultMode);
  const selectedTeam = useMemo(
    () => teams.find((team) => team.abbr === teamAbbr) ?? null,
    [teamAbbr, teams],
  );
  const defaultBadgeTextColor = getReadableTextColor(selectedTeam?.color_primary ?? '#0f172a');

  const isHydrated = hasHydrated && experienceHasHydrated;

  useEffect(() => {
    if (!isHydrated) return;
    if (!saveId) {
      router.replace('/');
    }
  }, [isHydrated, router, saveId]);

  if (!isHydrated || !saveId) {
    return (
      <AppShell>
        <div className="min-h-[1px]" />
      </AppShell>
    );
  }

  const handleContinue = async () => {
    const actionableSaveId = await ensureRecoverableSaveId(
      {
        preferredSaveId: saveId,
        teamId,
        teamAbbr,
        capSpace,
        capLimit,
        roster,
        phase,
        unlocked,
      },
      setSaveHeader,
    );

    if (!actionableSaveId) {
      router.replace('/');
      return;
    }

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
      <div className="mx-auto w-full max-w-5xl pb-40 md:pb-0">
        <div className="flex w-full flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
              Experience
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">Choose your experience</h1>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {EXPERIENCE_OPTIONS.map((option) => {
              const isSelected = selectedMode === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border bg-white p-4 text-left transition ${
                    isSelected
                      ? 'border-slate-900/30 ring-2 ring-slate-900/10'
                      : 'border-border hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                  onClick={() => setSelectedMode(option.key)}
                >
                  {option.isDefault ? (
                    <div className="absolute right-0 top-[-2px] z-10">
                      <Badge
                        variant="secondary"
                        className="overflow-hidden rounded-bl-sm rounded-br-none rounded-tl-none rounded-tr-none border-transparent bg-[var(--team-primary)] px-3.5"
                        style={{ color: defaultBadgeTextColor }}
                      >
                        Default
                      </Badge>
                    </div>
                  ) : null}
                  <div className="pr-20">
                    <p className="text-sm font-semibold text-foreground">{option.title}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleContinue}
              className="w-full bg-[var(--team-primary)] text-[var(--team-primary-foreground)] hover:bg-[var(--team-primary)] hover:opacity-95 md:w-auto"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
      <AdSlot placement="ANCHOR" responsive={{ hideOnDesktop: true }} />
    </AppShell>
  );
}
