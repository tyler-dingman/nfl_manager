'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, DraftingCompass, Handshake, Trophy } from 'lucide-react';

import AppShell from '@/components/app-shell';
import { AdSlot } from '@/components/ads/AdSlot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useSaveStore } from '@/features/save/save-store';
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

const EXPERIENCE_ICONS = {
  full: Trophy,
  freeAgency: Handshake,
  draft: DraftingCompass,
} as const;

export default function ExperiencePage() {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const teamAbbr = useSaveStore((state) => state.teamAbbr);
  const teamId = useSaveStore((state) => state.teamId);
  const capSpace = useSaveStore((state) => state.capSpace);
  const capLimit = useSaveStore((state) => state.capLimit);
  const roster = useSaveStore((state) => state.roster);
  const phase = useSaveStore((state) => state.phase);
  const franchiseYear = useSaveStore((state) => state.franchiseYear);
  const unlocked = useSaveStore((state) => state.unlocked);
  const hasHydrated = useSaveStore((state) => state.hasHydrated);
  const setPhase = useSaveStore((state) => state.setPhase);
  const setSaveHeader = useSaveStore((state) => state.setSaveHeader);
  const experienceHasHydrated = useExperienceStore((state) => state.hasHydrated);
  const setFullExperience = useExperienceStore((state) => state.setFullExperience);
  const enterSandboxStep = useExperienceStore((state) => state.enterSandboxStep);

  const defaultMode = useMemo(() => 'full' as const, []);
  const [selectedMode, setSelectedMode] = useState<ExperienceMode>(defaultMode);

  const isHydrated = hasHydrated && experienceHasHydrated;
  const expiringContracts = roster.filter(
    (player) => (player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 0) <= 1,
  ).length;
  const rosterCount = roster.filter((player) => player.status?.toLowerCase() !== 'cut').length;

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
        year: franchiseYear,
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

    if (selectedMode === 'freeAgency') {
      enterSandboxStep('free-agency');
      if (phase !== 'free_agency') {
        await setPhase('free_agency');
      }
      router.push('/free-agents');
      return;
    }

    enterSandboxStep('draft');
    if (phase !== 'draft') {
      await setPhase('draft');
    }
    router.push('/draft/room?mode=mock');
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl pb-40 md:pb-0">
        <div className="flex w-full flex-col gap-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--team-primary)]">
              Front Office Overview
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">
              Decisions on your desk
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The moves that need your attention before the franchise advances.
            </p>
          </div>

          <section className="grid gap-4 md:grid-cols-3" aria-label="Decisions on your desk">
            <Link href="/roster?view=resign" className="front-office-decision-card">
              <span className="front-office-decision-kicker">Contracts</span>
              <strong>
                {expiringContracts} expiring contract{expiringContracts === 1 ? '' : 's'}
              </strong>
              <p>Review upcoming free agents and choose who belongs in the plan.</p>
              <span className="front-office-decision-action">
                Review contracts <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link href="/cap-space" className="front-office-decision-card">
              <span className="front-office-decision-kicker">Team finances</span>
              <strong>${capSpace.toFixed(1)}M in cap room</strong>
              <p>See commitments, positional spending, and the flexibility behind every move.</p>
              <span className="front-office-decision-action">
                Open cap table <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link href="/roster?view=depth" className="front-office-decision-card">
              <span className="front-office-decision-kicker">Roster plan</span>
              <strong>{rosterCount} active players</strong>
              <p>Inspect the depth chart before targeting trades, signings, or the draft.</p>
              <span className="front-office-decision-action">
                Review depth <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </section>

          <section className="front-office-building-feed">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.25em] text-muted-foreground">
                Around the building
              </p>
              <h2>Franchise briefing</h2>
            </div>
            <div className="front-office-building-items">
              <p>
                <strong>Personnel:</strong> Your current roster has {rosterCount} active players.
              </p>
              <p>
                <strong>Finance:</strong>{' '}
                {capSpace < 0
                  ? 'The club must clear cap space before making additional commitments.'
                  : `The club has $${capSpace.toFixed(1)}M available against the cap.`}
              </p>
              <p>
                <strong>Next desk:</strong>{' '}
                {phase === 'resign_cut'
                  ? 'Resolve expiring contracts and roster cuts.'
                  : phase === 'free_agency'
                    ? 'Evaluate the active free-agent market.'
                    : phase === 'draft'
                      ? 'Prepare the draft board.'
                      : 'Review the completed offseason.'}
              </p>
            </div>
          </section>

          <div className="border-t border-border pt-7">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Change simulation path
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Choose your experience</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {EXPERIENCE_OPTIONS.map((option) => {
              const isSelected = selectedMode === option.key;
              const Icon = EXPERIENCE_ICONS[option.key];
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`front-office-experience-card group relative flex min-h-64 h-full flex-col overflow-hidden rounded-2xl border p-6 text-left transition ${
                    isSelected
                      ? 'is-selected border-transparent bg-[var(--team-dark)] text-[var(--team-on-dark)] shadow-xl'
                      : 'border-border bg-white hover:-translate-y-0.5 hover:shadow-lg'
                  }`}
                  onClick={() => setSelectedMode(option.key)}
                >
                  {option.isDefault ? (
                    <div className="absolute right-0 top-[-2px] z-10">
                      <Badge
                        variant="secondary"
                        className="overflow-hidden rounded-bl-sm rounded-br-none rounded-tl-none rounded-tr-none border-transparent bg-[var(--team-dark)] px-3.5 text-[var(--team-on-dark)]"
                      >
                        Default
                      </Badge>
                    </div>
                  ) : null}
                  <Icon className="mb-auto h-9 w-9" aria-hidden="true" />
                  <div className="mt-8 pr-20">
                    <p
                      className={`text-xl font-semibold ${isSelected ? 'text-inherit' : 'text-foreground'}`}
                    >
                      {option.title}
                    </p>
                  </div>
                  <p
                    className={`mt-1 text-sm ${isSelected ? 'text-inherit opacity-80' : 'text-muted-foreground'}`}
                  >
                    {option.description}
                  </p>
                  <span
                    className={`mt-6 inline-flex h-10 w-10 items-center justify-center rounded-full border ${isSelected ? 'border-current' : 'border-border bg-[#f7f4ee]'}`}
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleContinue}
              className="w-full bg-[var(--team-dark)] text-[var(--team-on-dark)] hover:bg-[var(--team-dark)] hover:opacity-95 focus-visible:ring-[var(--team-dark)] md:w-auto"
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
