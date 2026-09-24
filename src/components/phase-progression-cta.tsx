'use client';
import { FrontOfficePhaseControl } from '@/components/front-office/front-office-phase-control';
import { useSaveStore } from '@/features/save/save-store';
import type { OffseasonStepId } from '@/features/experience/offseason-steps';

export function PhaseProgressionCTA(_props: {
  currentStep: OffseasonStepId;
  completedSteps: string[];
}) {
  const { franchiseYear, phase, freeAgencyWave } = useSaveStore();
  return (
    <FrontOfficePhaseControl season={franchiseYear} phase={phase} freeAgencyWave={freeAgencyWave} />
  );
}
