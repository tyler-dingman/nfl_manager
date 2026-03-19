'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Circle } from 'lucide-react';

import { getReadableTextColor } from '@/lib/color-utils';
import { cn } from '@/lib/utils';

type StepIndicatorProps = {
  currentStep: number;
  steps: string[];
  teamColor?: string | null;
  overallProgressPercent?: number;
  progressLabel?: string;
  unlockedStepIndex?: number;
  completedStepIndices?: number[];
  className?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const hexToRgb = (color: string) => {
  const normalized = color.trim().replace('#', '');
  const hex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  if (hex.length !== 6) return null;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
};

const withAlpha = (color: string | null | undefined, alpha: number, fallback: string) => {
  if (!color) return fallback;
  const rgb = hexToRgb(color);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const formatLabel = (label: string) => {
  if (label === 'Free Agency') {
    return (
      <>
        <span className="md:hidden lg:inline">Free Agency</span>
        <span className="hidden md:inline lg:hidden">FA</span>
      </>
    );
  }

  return label;
};

export function StepIndicator({
  currentStep,
  steps,
  teamColor,
  overallProgressPercent = 0,
  progressLabel,
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
  const foregroundColor = teamColor ? getReadableTextColor(teamColor) : '#ffffff';
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

  const resolvedProgressLabel = progressLabel ?? `Offseason Progress ${overallProgressPercent}%`;
  const progressWidth = `${Math.max(0, Math.min(100, overallProgressPercent))}%`;

  return (
    <div
      className={cn(
        'inline-flex max-w-full flex-col gap-2 overflow-hidden rounded-2xl border px-2 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/10',
        className,
      )}
      style={{
        backgroundColor: withAlpha(teamColor ?? '#0f172a', 0.82, 'rgba(15, 23, 42, 0.82)'),
        borderColor: withAlpha(teamColor ?? '#0f172a', 0.32, 'rgba(255,255,255,0.18)'),
        color: foregroundColor === '#ffffff' ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.96)',
      }}
      aria-label={`Offseason step ${safeCurrentStep + 1} of ${steps.length}`}
    >
      <div className="flex max-w-full items-center gap-1 overflow-x-auto">
        {steps.map((step, index) => {
          const isCompleted =
            index < safeCurrentStep || Boolean(completedStepIndices?.includes(index));
          const isActive = index === safeCurrentStep;
          const isAvailableFuture = !isCompleted && index > safeCurrentStep && index <= safeUnlockedStep;
          const isLockedFuture = !isCompleted && index > safeUnlockedStep;
          const shouldGlow = completedFlashStep === index;
          const shouldPulse = unlockPulseStep === index;

          return (
            <div
              key={step}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all duration-300 sm:text-[13px]',
                isActive
                  ? 'bg-white/14'
                  : isCompleted
                    ? 'bg-white/8'
                    : isAvailableFuture
                      ? 'bg-white/5 opacity-90'
                      : 'bg-transparent opacity-70',
                shouldPulse ? 'scale-[1.02]' : null,
              )}
              style={
                shouldGlow
                  ? {
                      boxShadow: `0 0 0 1px ${withAlpha(teamColor ?? '#0f172a', 0.2, 'rgba(255,255,255,0.18)')}, 0 0 16px ${withAlpha(teamColor ?? '#0f172a', 0.34, 'rgba(255,255,255,0.16)')}`,
                    }
                  : undefined
              }
            >
              <span
                className={cn(
                  'inline-flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-300',
                  isActive || isCompleted
                    ? 'border-current bg-current/15'
                    : isAvailableFuture
                      ? 'border-current/60 bg-current/10'
                      : 'border-current/45',
                  shouldPulse ? 'animate-pulse' : null,
                )}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Circle
                    className={cn(
                      'h-2.5 w-2.5',
                      isLockedFuture ? 'opacity-45' : isAvailableFuture ? 'opacity-80' : 'fill-current',
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                )}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap transition-opacity duration-300',
                  isLockedFuture ? 'opacity-70' : null,
                )}
              >
                {formatLabel(step)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="min-w-0 px-1">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80 sm:text-[11px]">
            {resolvedProgressLabel}
          </span>
          <span className="text-[10px] font-semibold opacity-80 sm:text-[11px]">
            {overallProgressPercent}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/16">
          <div
            className="h-1.5 rounded-full bg-white/90 transition-all duration-500"
            style={{ width: progressWidth }}
          />
        </div>
      </div>
    </div>
  );
}
