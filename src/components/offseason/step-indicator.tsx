'use client';

import { Check, Circle } from 'lucide-react';

import { getReadableTextColor } from '@/lib/color-utils';
import { cn } from '@/lib/utils';

type StepIndicatorProps = {
  currentStep: number;
  steps: string[];
  teamColor?: string | null;
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
  className,
}: StepIndicatorProps) {
  const safeCurrentStep = clamp(currentStep, 0, Math.max(steps.length - 1, 0));
  const foregroundColor = teamColor ? getReadableTextColor(teamColor) : '#ffffff';

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border px-1.5 py-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/10',
        className,
      )}
      style={{
        backgroundColor: withAlpha(teamColor ?? '#0f172a', 0.82, 'rgba(15, 23, 42, 0.82)'),
        borderColor: withAlpha(teamColor ?? '#0f172a', 0.32, 'rgba(255,255,255,0.18)'),
        color: foregroundColor === '#ffffff' ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.96)',
      }}
      aria-label={`Offseason step ${safeCurrentStep + 1} of ${steps.length}`}
    >
      {steps.map((step, index) => {
        const isCompleted = index < safeCurrentStep;
        const isActive = index === safeCurrentStep;
        const isFuture = index > safeCurrentStep;

        return (
          <div
            key={step}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 sm:text-[13px]',
              isActive
                ? 'bg-white/14'
                : isCompleted
                  ? 'bg-white/8'
                  : 'bg-transparent opacity-80',
            )}
          >
            <span
              className={cn(
                'inline-flex h-4 w-4 items-center justify-center rounded-full border',
                isActive || isCompleted ? 'border-current bg-current/15' : 'border-current/50',
              )}
            >
              {isCompleted ? (
                <Check className="h-3 w-3" />
              ) : (
                <Circle
                  className={cn('h-2.5 w-2.5', isFuture ? 'opacity-60' : 'fill-current')}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              )}
            </span>
            <span className={cn('whitespace-nowrap', isFuture ? 'opacity-75' : null)}>
              {formatLabel(step)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
