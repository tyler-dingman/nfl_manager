import { OFFSEASON_STEPS, STEP_ROUTE_PREFIXES, type OffseasonStepId } from './offseason-steps';

export const getStepIndex = (stepId: OffseasonStepId) =>
  OFFSEASON_STEPS.findIndex((step) => step.id === stepId);

export const isStepUnlocked = (stepId: OffseasonStepId, currentStep: OffseasonStepId) =>
  getStepIndex(stepId) <= getStepIndex(currentStep);

export const getRouteForStep = (stepId: OffseasonStepId) =>
  OFFSEASON_STEPS.find((step) => step.id === stepId)?.route ?? '/roster';

export const getStepForPath = (pathname: string): OffseasonStepId | null => {
  const normalized = pathname.split('?')[0];
  const entry = (Object.entries(STEP_ROUTE_PREFIXES) as Array<[OffseasonStepId, string[]]>).find(
    ([, prefixes]) => prefixes.some((prefix) => normalized.startsWith(prefix)),
  );
  return entry?.[0] ?? null;
};
