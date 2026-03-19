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
  const [hasCheckedStorage, setHasCheckedStorage] = React.useState(false);
  const hasSeenRef = React.useRef(false);

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined' || hasCheckedStorage) return;
    const hasSeen = window.localStorage.getItem(HAS_SEEN_ONBOARDING_KEY) === 'true';
    hasSeenRef.current = hasSeen;
    setHasCheckedStorage(true);
    if (!hasSeen) {
      setCurrentStep(0);
      setIsOpen(true);
    }
  }, [enabled, hasCheckedStorage]);

  React.useEffect(() => {
    if (!enabled && isOpen) {
      setIsOpen(false);
    }
  }, [enabled, isOpen]);

  const markSeen = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HAS_SEEN_ONBOARDING_KEY, 'true');
    }
    hasSeenRef.current = true;
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
    isOpen: hasCheckedStorage && !hasSeenRef.current && isOpen,
    currentStep,
    totalSteps: stepCount,
    next,
    previous,
    skip,
  };
}
