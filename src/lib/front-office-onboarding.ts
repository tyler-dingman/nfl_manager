import type { FrontOfficePath } from '@/types/front-office';

export function inferFrontOfficePath(input: {
  selectedPath?: FrontOfficePath | null;
  phase: string;
  experienceMode: 'sandbox' | 'full';
  completedStepCount: number;
}): FrontOfficePath | null {
  if (input.selectedPath) return input.selectedPath;
  const hasExistingProgress =
    input.phase !== 'resign_cut' || input.experienceMode === 'full' || input.completedStepCount > 0;
  return hasExistingProgress ? 'full' : null;
}

export function initializeFrontOfficeSimulationPhase(
  simulationPhase: string,
  realWorldPhase: string,
) {
  return simulationPhase === 'resign_cut' ? realWorldPhase : simulationPhase;
}
