'use client';

import { getReadableTextColor } from '@/lib/color-utils';
import { Button } from '@/components/ui/button';

type Props = {
  title: string;
  stepNumber: number;
  totalSteps: number;
  instruction: string;
  canContinue: boolean;
  continueLabel?: string;
  backgroundColor?: string;
  onContinue: () => void;
  onSkip: () => void;
};

export function StepHeader({
  title,
  stepNumber,
  totalSteps,
  instruction,
  canContinue,
  continueLabel = 'Continue',
  backgroundColor,
  onContinue,
  onSkip,
}: Props) {
  const useCustomTheme = Boolean(backgroundColor);
  const foregroundColor = useCustomTheme
    ? getReadableTextColor(backgroundColor ?? '#0f172a')
    : '#0f172a';
  const subtleTextColor = useCustomTheme
    ? foregroundColor === '#ffffff'
      ? 'rgba(255, 255, 255, 0.86)'
      : 'rgba(15, 23, 42, 0.8)'
    : undefined;

  return (
    <div
      className="mb-5 rounded-2xl border border-border p-4 shadow-sm sm:mb-6 sm:p-5"
      style={
        useCustomTheme
          ? {
              backgroundColor,
              color: foregroundColor,
              borderColor: 'transparent',
            }
          : { backgroundColor: '#ffffff' }
      }
    >
      <p
        className="text-xs font-semibold uppercase tracking-[0.2em]"
        style={useCustomTheme ? { color: subtleTextColor } : undefined}
      >
        {title} — Step {stepNumber} of {totalSteps}
      </p>
      <p
        className="mt-2 max-w-3xl text-sm leading-relaxed"
        style={useCustomTheme ? { color: subtleTextColor } : undefined}
      >
        {instruction}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={
            useCustomTheme
              ? 'h-10 w-full border border-white/20 bg-white/95 text-slate-900 hover:bg-white sm:w-auto'
              : 'h-10 w-full bg-[var(--team-primary)] text-[var(--team-primary-foreground)] hover:opacity-95 sm:w-auto'
          }
        >
          {continueLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className={
            useCustomTheme
              ? 'h-10 border border-white/20 bg-transparent hover:bg-white/15'
              : 'h-10'
          }
          style={useCustomTheme ? { color: foregroundColor } : undefined}
        >
          Skip Step
        </Button>
      </div>
    </div>
  );
}
