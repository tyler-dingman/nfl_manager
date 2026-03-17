import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { OFFSEASON_STEPS, type OffseasonStepId } from '@/features/experience/offseason-steps';

type ExperienceState = {
  mode: 'sandbox' | 'full';
  currentStep: OffseasonStepId;
  completedSteps: string[];
  manageSubstepsCompleted: string[];
  setFullExperience: () => void;
  setSandboxExperience: () => void;
  markManageSubstepComplete: (substep: string) => void;
  completeCurrentStep: () => OffseasonStepId | null;
  skipCurrentStep: () => OffseasonStepId | null;
};

const firstStep = OFFSEASON_STEPS[0]?.id ?? 'manage';

const getNextStep = (step: OffseasonStepId): OffseasonStepId | null => {
  const index = OFFSEASON_STEPS.findIndex((item) => item.id === step);
  if (index < 0 || index + 1 >= OFFSEASON_STEPS.length) return null;
  return OFFSEASON_STEPS[index + 1]?.id ?? null;
};

const completeStep = (state: ExperienceState): ExperienceState => {
  const nextCompleted = state.completedSteps.includes(state.currentStep)
    ? state.completedSteps
    : [...state.completedSteps, state.currentStep];
  const nextStep = getNextStep(state.currentStep);

  return {
    ...state,
    completedSteps: nextCompleted,
    currentStep: nextStep ?? state.currentStep,
  };
};

export const useExperienceStore = create<ExperienceState>()(
  persist(
    (set) => ({
      mode: 'sandbox',
      currentStep: firstStep,
      completedSteps: [],
      manageSubstepsCompleted: [],
      setFullExperience: () =>
        set((state) => ({
          ...state,
          mode: 'full',
          currentStep: 'manage',
          completedSteps: [],
          manageSubstepsCompleted: [],
        })),
      setSandboxExperience: () =>
        set((state) => ({
          ...state,
          mode: 'sandbox',
        })),
      markManageSubstepComplete: (substep) =>
        set((state) => ({
          ...state,
          manageSubstepsCompleted: state.manageSubstepsCompleted.includes(substep)
            ? state.manageSubstepsCompleted
            : [...state.manageSubstepsCompleted, substep],
        })),
      completeCurrentStep: () => {
        let nextStep: OffseasonStepId | null = null;
        set((state) => {
          nextStep = getNextStep(state.currentStep);
          return completeStep(state);
        });
        return nextStep;
      },
      skipCurrentStep: () => {
        let nextStep: OffseasonStepId | null = null;
        set((state) => {
          nextStep = getNextStep(state.currentStep);
          if (state.currentStep === 'manage') {
            return completeStep({
              ...state,
              manageSubstepsCompleted: OFFSEASON_STEPS[0]?.substeps ?? [],
            });
          }
          return completeStep(state);
        });
        return nextStep;
      },
    }),
    {
      name: 'nfl-manager-experience',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mode: state.mode,
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        manageSubstepsCompleted: state.manageSubstepsCompleted,
      }),
    },
  ),
);
