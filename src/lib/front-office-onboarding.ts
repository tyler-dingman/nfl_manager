import type { FrontOfficePath } from '@/types/front-office';
import type { FranchiseSimulationState } from '@/types/front-office';

export function inferFrontOfficePath(input: {
  selectedPath?: FrontOfficePath | null;
  phase: string;
  experienceMode: 'sandbox' | 'full';
  completedStepCount: number;
  simulationPhase?: string | null;
  initializedAt?: string | null;
  simulation?: FranchiseSimulationState | null;
}): FrontOfficePath | null {
  if (input.selectedPath) return input.selectedPath;
  const simulationHasProgress = Boolean(
    input.simulation &&
    (input.simulation.currentWeek >= 1 ||
      input.simulation.transactions.length > 0 ||
      input.simulation.games.some((game) => game.played)),
  );
  const hasExistingProgress =
    Boolean(input.initializedAt) ||
    Boolean(input.simulationPhase && input.simulationPhase !== 'resign_cut') ||
    simulationHasProgress ||
    input.phase !== 'resign_cut' ||
    input.completedStepCount > 0;
  return hasExistingProgress ? 'full' : null;
}

export const shouldShowFrontOfficeOnboarding = (resolvedPath: FrontOfficePath | null) =>
  resolvedPath === null;

export function initializeFrontOfficeSimulationPhase(
  simulationPhase: string,
  realWorldPhase: string,
) {
  return simulationPhase === 'resign_cut' ? realWorldPhase : simulationPhase;
}
