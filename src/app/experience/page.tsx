'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, DraftingCompass, Handshake, Trophy } from 'lucide-react';

import AppShell from '@/components/app-shell';
import { FrontOfficeHome } from '@/components/front-office/front-office-home';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useSaveStore } from '@/features/save/save-store';
import { apiFetch } from '@/lib/api';
import {
  inferFrontOfficePath,
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
    <AppShell showTeamSummary={false} showLeagueWire={false}>
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
  const applyAuthoritativeFranchiseState = useSaveStore(
    (state) => state.applyAuthoritativeFranchiseState,
  );
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
          if (persistedState?.simulation) {
            resolvedPhase = persistedState.simulation.phase;
            applyAuthoritativeFranchiseState(persistedState.simulation);
          } else if (persistedState?.simulationPhase) {
            resolvedPhase = persistedState.simulationPhase;
          }
        }
      } catch {
        // Anonymous and offline sessions intentionally fall back to this save's local preference.
      }

      // Full Experience starts at the opening of the season. Repair saves created by the
      // earlier onboarding flow only when they have not initialized simulation progress yet.
      if (
        resolvedPath === 'full' &&
        resolvedPhase === 'resign_cut' &&
        !persistedState?.simulation
      ) {
        resolvedPhase = 'week-1';
        await apiFetch('/api/front-office/state', {
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
        const initializeResponse = await apiFetch('/api/front-office/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ saveId, action: 'initialize', target: resolvedPhase }),
        }).catch(() => null);
        if (initializeResponse?.ok) {
          const initialized = (await initializeResponse.json()) as {
            state?: FranchiseSimulationState;
          };
          if (initialized.state) {
            persistedState = { ...persistedState, simulation: initialized.state };
            applyAuthoritativeFranchiseState(initialized.state);
          }
        }
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
      if (resolvedPath === 'draft') router.replace('/front-office/draft');
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
    applyAuthoritativeFranchiseState,
    router,
    saveId,
    setFullExperience,
    teamAbbr,
  ]);

  if (!isHydrated || !saveId || !frontOfficeReady) {
    return (
      <AppShell showTeamSummary={false} showLeagueWire={false}>
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
    if (selectedMode === 'full') {
      initialPhase = 'week-1';
    } else if (selectedMode === 'free_agency') {
      initialPhase = 'free_agency';
    } else if (selectedMode === 'draft') {
      initialPhase = 'draft';
    }

    const metadataResponse = await apiFetch('/api/front-office/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId: actionableSaveId,
        teamAbbr,
        season: franchiseYear,
        selectedPath: selectedMode,
        simulationPhase: initialPhase,
      }),
    }).catch(() => null);
    if (!metadataResponse?.ok) return;
    const simulationResponse = await apiFetch('/api/front-office/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId: actionableSaveId,
        action: 'initialize',
        target: initialPhase,
      }),
    });
    const simulationPayload = (await simulationResponse.json().catch(() => null)) as {
      state?: FranchiseSimulationState;
    } | null;
    if (!simulationResponse.ok || !simulationPayload?.state) return;
    applyAuthoritativeFranchiseState(simulationPayload.state);
    localStorage.setItem(`dnd-front-office-path:${actionableSaveId}`, selectedMode);
    setSavedPath(selectedMode);

    if (selectedMode === 'full') {
      setFullExperience();
      router.replace('/experience');
      return;
    }

    if (selectedMode === 'free_agency') {
      enterSandboxStep('free-agency');
      router.push('/free-agents');
      return;
    }

    enterSandboxStep('draft');
    router.push('/front-office/draft');
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
    <AppShell showLeagueWire={false} showTeamSummary={false}>
      <FrontOfficeHome saveId={saveId} teamAbbr={teamAbbr} roster={roster} />
    </AppShell>
  );
}
