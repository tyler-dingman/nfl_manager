'use client';

import { Button } from '@/components/ui/button';

type Props = {
  title: string;
  stepNumber: number;
  totalSteps: number;
  instruction: string;
  canContinue: boolean;
  continueLabel?: string;
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
  onContinue,
  onSkip,
}: Props) {
  return (
    <div className="mb-6 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title} — Step {stepNumber} of {totalSteps}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{instruction}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onContinue} disabled={!canContinue}>
          {continueLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip}>
          Skip Step
        </Button>
      </div>
    </div>
  );
}
