'use client';

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
  canContinue,
  continueLabel = 'Continue',
  onContinue,
  onSkip,
}: Props) {
  return (
    <div className="mb-4 flex flex-col items-stretch gap-2 sm:mb-5 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="h-10 w-full bg-[var(--team-primary)] text-[var(--team-primary-foreground)] hover:bg-[var(--team-primary)] hover:opacity-95 sm:w-auto"
        >
          {continueLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="h-10"
        >
          Skip Step
        </Button>
    </div>
  );
}
