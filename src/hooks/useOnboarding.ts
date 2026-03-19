'use client';

import * as React from 'react';

export const HAS_SEEN_ONBOARDING_KEY = 'hasSeenOnboarding';

type UseOnboardingOptions = {
  enabled: boolean;
  stepCount: number;
};

export function useOnboarding({ enabled, stepCount }: UseOnboardingOptions) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const hasSeen = window.localStorage.getItem(HAS_SEEN_ONBOARDING_KEY) === 'true';
    if (!hasSeen) {
      setIsOpen(true);
      setCurrentStep(0);
    }
  }, [enabled]);

  const markSeen = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HAS_SEEN_ONBOARDING_KEY, 'true');
    }
    setIsOpen(false);
  }, []);

  const skip = React.useCallback(() => {
    markSeen();
  }, [markSeen]);

  const next = React.useCallback(() => {
    setCurrentStep((step) => {
      if (step >= stepCount - 1) {
        markSeen();
        return step;
      }
      return step + 1;
    });
  }, [markSeen, stepCount]);

  const previous = React.useCallback(() => {
    setCurrentStep((step) => Math.max(0, step - 1));
  }, []);

  return {
    isOpen,
    currentStep,
    totalSteps: stepCount,
    next,
    previous,
    skip,
  };
}
