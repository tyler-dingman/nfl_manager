'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, DraftingCompass, Handshake, Trophy } from 'lucide-react';

import AppShell from '@/components/app-shell';
import { FrontOfficeOverviewHero } from '@/components/front-office/front-office-overview-hero';
import { AdSlot } from '@/components/ads/AdSlot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import {
  inferFrontOfficePath,
  initializeFrontOfficeSimulationPhase,
  shouldShowFrontOfficeOnboarding,
} from '@/lib/front-office-onboarding';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';
import type { FranchiseSimulationState, FrontOfficePath } from '@/types/front-office';

type ExperienceMode = FrontOfficePath;

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
    key: 'free_agency',
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
  free_agency: Handshake,
  draft: DraftingCompass,
} as const;

function FrontOfficePathGate({
  selectedMode,
  onSelect,
  onContinue,
}: {
  selectedMode: ExperienceMode;
  onSelect: (mode: ExperienceMode) => void;
  onContinue: () => void;
}) {
  return (
    <AppShell showTeamSummary={false}>
      <section className="mx-auto flex min-h-[calc(100vh-13rem)] w-full max-w-6xl flex-col pb-10 pt-3 sm:pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Choose your path
        </p>
        <h1 className="mt-2 text-3xl font-black text-foreground">Choose your experience</h1>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
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
                onClick={() => onSelect(option.key)}
              >
                {option.isDefault ? (
                  <div className="absolute right-0 top-[-2px] z-10">
                    <Badge
                      variant="secondary"
                      className="rounded-bl-sm rounded-br-none rounded-tl-none rounded-tr-none border-transparent bg-[var(--team-dark)] px-3.5 text-[var(--team-on-dark)]"
                    >
                      Default
                    </Badge>
                  </div>
                ) : null}
                <Icon className="mb-auto h-9 w-9" aria-hidden="true" />
                <p
                  className={`mt-8 text-xl font-semibold ${isSelected ? 'text-inherit' : 'text-foreground'}`}
                >
                  {option.title}
                </p>
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
        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            onClick={onContinue}
            className="w-full bg-[var(--team-dark)] text-[var(--team-on-dark)] hover:bg-[var(--team-dark)] hover:opacity-95 md:w-auto"
          >
            Continue
          </Button>
        </div>
      </section>
    </AppShell>
  );
}

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
  const experienceMode = useExperienceStore((state) => state.mode);
  const completedSteps = useExperienceStore((state) => state.completedSteps);
  const setFullExperience = useExperienceStore((state) => state.setFullExperience);
  const enterSandboxStep = useExperienceStore((state) => state.enterSandboxStep);

  const defaultMode = useMemo(() => 'full' as const, []);
  const [selectedMode, setSelectedMode] = useState<ExperienceMode>(defaultMode);
  const [savedPath, setSavedPath] = useState<FrontOfficePath | null>(null);
  const [frontOfficeReady, setFrontOfficeReady] = useState(false);

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

  useEffect(() => {
    if (!isHydrated || !saveId) return;
    let active = true;
    const localKey = `dnd-front-office-path:${saveId}`;
    const load = async () => {
      let resolvedPath = localStorage.getItem(localKey) as FrontOfficePath | null;
      let resolvedPhase = phase;
      let persistedState: {
        selectedPath?: FrontOfficePath | null;
        simulationPhase?: string | null;
        initializedAt?: string | null;
        simulation?: FranchiseSimulationState | null;
      } | null = null;
      try {
        const response = await apiFetch(
          `/api/front-office/state?saveId=${encodeURIComponent(saveId)}`,
        );
        if (response.ok) {
          const payload = (await response.json()) as {
            state?: {
              selectedPath?: FrontOfficePath | null;
              simulationPhase?: string | null;
              initializedAt?: string | null;
              simulation?: FranchiseSimulationState | null;
            } | null;
          };
          persistedState = payload.state ?? null;
          resolvedPath = persistedState?.selectedPath ?? resolvedPath;
          if (persistedState?.simulationPhase && persistedState.simulationPhase !== phase) {
            resolvedPhase = persistedState.simulationPhase;
            await setPhase(resolvedPhase);
          }
        }
      } catch {
        // Anonymous and offline sessions intentionally fall back to this save's local preference.
      }

      const inferredPath = inferFrontOfficePath({
        selectedPath: resolvedPath,
        phase: resolvedPhase,
        experienceMode,
        completedStepCount: completedSteps.length,
        simulationPhase: persistedState?.simulationPhase ?? null,
        initializedAt: persistedState?.initializedAt ?? null,
        simulation: persistedState?.simulation ?? null,
      });
      if (!resolvedPath && inferredPath) {
        resolvedPath = inferredPath;
        localStorage.setItem(localKey, resolvedPath);
        void apiFetch('/api/front-office/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saveId,
            teamAbbr,
            season: franchiseYear,
            selectedPath: resolvedPath,
            simulationPhase: resolvedPhase,
          }),
        }).catch(() => undefined);
      }
      if (!active) return;
      setSavedPath(resolvedPath);
      if (resolvedPath === 'full') setFullExperience();
      if (resolvedPath === 'free_agency') enterSandboxStep('free-agency');
      if (resolvedPath === 'draft') enterSandboxStep('draft');
      setFrontOfficeReady(true);
      if (resolvedPath === 'free_agency') router.replace('/free-agents');
      if (resolvedPath === 'draft') router.replace('/draft/room?mode=mock');
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    completedSteps.length,
    enterSandboxStep,
    experienceMode,
    franchiseYear,
    isHydrated,
    phase,
    router,
    saveId,
    setFullExperience,
    setPhase,
    teamAbbr,
  ]);

  if (!isHydrated || !saveId || !frontOfficeReady) {
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

    let initialPhase = phase;
    if (selectedMode === 'full' && phase === 'resign_cut') {
      const calendarResponse = await apiFetch('/api/front-office/calendar');
      if (calendarResponse.ok) {
        const payload = (await calendarResponse.json()) as {
          calendar?: { frontOfficePhase?: string };
        };
        initialPhase = initializeFrontOfficeSimulationPhase(
          phase,
          payload.calendar?.frontOfficePhase ?? phase,
        );
      }
    } else if (selectedMode === 'free_agency') {
      initialPhase = 'free_agency';
    } else if (selectedMode === 'draft') {
      initialPhase = 'draft';
    }

    localStorage.setItem(`dnd-front-office-path:${actionableSaveId}`, selectedMode);
    await apiFetch('/api/front-office/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId: actionableSaveId,
        teamAbbr,
        season: franchiseYear,
        selectedPath: selectedMode,
        simulationPhase: initialPhase,
      }),
    }).catch(() => undefined);
    setSavedPath(selectedMode);

    if (selectedMode === 'full') {
      setFullExperience();
      if (phase !== initialPhase) {
        await setPhase(initialPhase);
      }
      router.push('/manage-team');
      return;
    }

    if (selectedMode === 'free_agency') {
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

  if (shouldShowFrontOfficeOnboarding(savedPath)) {
    return (
      <FrontOfficePathGate
        selectedMode={selectedMode}
        onSelect={setSelectedMode}
        onContinue={() => void handleContinue()}
      />
    );
  }

  return (
    <AppShell>
      <div className="-mx-4 -mt-6 mb-7 sm:-mt-8 md:-mx-8">
        <FrontOfficeOverviewHero />
      </div>
      <div className="mx-auto w-full max-w-6xl pb-40 md:pb-0">
        <div className="flex w-full flex-col gap-7">
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
        </div>
      </div>
      <AdSlot placement="ANCHOR" responsive={{ hideOnDesktop: true }} />
    </AppShell>
  );
}
