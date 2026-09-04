'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

type StepIndicatorProps = {
  currentStep: number;
  steps: string[];
  unlockedStepIndex?: number;
  completedStepIndices?: number[];
  className?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatLabel = (label: string) => {
  if (label === 'Free Agency') {
    return (
      <>
        <span className="sm:hidden">FA</span>
        <span className="hidden sm:inline lg:hidden">FA</span>
        <span className="hidden lg:inline">Free Agency</span>
      </>
    );
  }

  return label;
};

export function StepIndicator({
  currentStep,
  steps,
  unlockedStepIndex,
  completedStepIndices,
  className,
}: StepIndicatorProps) {
  const safeCurrentStep = clamp(currentStep, 0, Math.max(steps.length - 1, 0));
  const safeUnlockedStep = clamp(
    unlockedStepIndex ?? safeCurrentStep,
    0,
    Math.max(steps.length - 1, 0),
  );
  const [completedFlashStep, setCompletedFlashStep] = useState<number | null>(null);
  const [unlockPulseStep, setUnlockPulseStep] = useState<number | null>(null);
  const previousStepRef = useRef(safeCurrentStep);
  const previousUnlockedRef = useRef(safeUnlockedStep);
  const previousCompletedRef = useRef<number[]>(completedStepIndices ?? []);

  useEffect(() => {
    const previousStep = previousStepRef.current;
    const previousUnlocked = previousUnlockedRef.current;
    const previousCompleted = previousCompletedRef.current;
    const nextCompleted = completedStepIndices ?? [];
    const newlyCompleted = nextCompleted.find((index) => !previousCompleted.includes(index));

    if (newlyCompleted !== undefined) {
      setCompletedFlashStep(newlyCompleted);
      if (newlyCompleted + 1 <= safeUnlockedStep) {
        setUnlockPulseStep(newlyCompleted + 1);
      }
    } else if (safeCurrentStep > previousStep) {
      setCompletedFlashStep(previousStep);
      setUnlockPulseStep(safeCurrentStep);
    } else if (safeUnlockedStep > previousUnlocked) {
      setUnlockPulseStep(safeUnlockedStep);
    }

    previousStepRef.current = safeCurrentStep;
    previousUnlockedRef.current = safeUnlockedStep;
    previousCompletedRef.current = nextCompleted;
  }, [completedStepIndices, safeCurrentStep, safeUnlockedStep]);

  useEffect(() => {
    if (completedFlashStep === null && unlockPulseStep === null) return;
    const timer = window.setTimeout(() => {
      setCompletedFlashStep(null);
      setUnlockPulseStep(null);
    }, 820);

    return () => window.clearTimeout(timer);
  }, [completedFlashStep, unlockPulseStep]);

  return (
    <div
      className={cn(
        'flex max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap',
        className,
      )}
      aria-label={`Offseason step ${safeCurrentStep + 1} of ${steps.length}`}
    >
      {steps.map((step, index) => {
        const isCompleted =
          index < safeCurrentStep || Boolean(completedStepIndices?.includes(index));
        const isActive = index === safeCurrentStep;
        const isAvailableFuture =
          !isCompleted && index > safeCurrentStep && index <= safeUnlockedStep;
        const isLockedFuture = !isCompleted && index > safeUnlockedStep;
        const shouldGlow = completedFlashStep === index;
        const shouldPulse = unlockPulseStep === index;

        return (
          <div key={step} className="flex shrink-0 items-center gap-2">
            {index > 0 ? (
              <span className="text-sm text-muted-foreground/70" aria-hidden="true">
                —
              </span>
            ) : null}
            <div
              className={cn(
                'inline-flex items-center gap-2 text-xs font-medium transition-all duration-300 sm:text-sm',
                isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground',
                shouldPulse ? 'scale-[1.02]' : null,
              )}
            >
              <span
                className={cn(
                  'inline-flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-300',
                  isActive || isCompleted
                    ? 'border-[var(--team-dark)] bg-[var(--team-dark)] text-[var(--team-on-dark)]'
                    : isAvailableFuture
                      ? 'border-slate-400 bg-transparent text-slate-500'
                      : 'border-slate-300 bg-transparent text-slate-400',
                  shouldGlow ? 'shadow-[0_0_0_4px_rgba(15,23,42,0.06)]' : null,
                  shouldPulse ? 'animate-pulse' : null,
                )}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Circle
                    className={cn('h-2.5 w-2.5', isActive ? 'fill-current' : 'opacity-80')}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                )}
              </span>
              <span className={cn(isLockedFuture ? 'opacity-70' : null)}>{formatLabel(step)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
