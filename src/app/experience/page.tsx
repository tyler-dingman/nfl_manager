'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FrontOfficeStart } from '@/components/front-office/front-office-start';

import AppShell from '@/components/app-shell';
import { FrontOfficeHome } from '@/components/front-office/front-office-home';
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

function FrontOfficePathGate({
  onContinue,
  busy,
  error,
  teamAbbr,
  season,
}: {
  onContinue: (mode: ExperienceMode) => void;
  busy: boolean;
  error: string;
  teamAbbr: string | null;
  season: number;
}) {
  return (
    <AppShell showTeamSummary={false} showLeagueWire={false} preFranchise>
      <FrontOfficeStart
        teamAbbr={teamAbbr}
        season={season}
        onStart={onContinue}
        busy={busy}
        error={error}
      />
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

  const [savedPath, setSavedPath] = useState<FrontOfficePath | null>(null);
  const [frontOfficeReady, setFrontOfficeReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const startingRef = useRef(false);

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

  const handleContinue = async (selectedMode: ExperienceMode) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setStartError('');
    try {
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
      if (!metadataResponse?.ok) throw new Error('Unable to save experience selection.');
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
      if (!simulationResponse.ok || !simulationPayload?.state)
        throw new Error('Unable to initialize experience.');
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
    } catch {
      setStartError('Could not start your experience. Please tap your choice to try again.');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  if (shouldShowFrontOfficeOnboarding(savedPath)) {
    return (
      <FrontOfficePathGate
        teamAbbr={teamAbbr}
        season={franchiseYear}
        onContinue={(mode) => void handleContinue(mode)}
        busy={starting}
        error={startError}
      />
    );
  }

  return (
    <AppShell showLeagueWire={false} showTeamSummary={false}>
      <FrontOfficeHome saveId={saveId} teamAbbr={teamAbbr} roster={roster} />
    </AppShell>
  );
}
