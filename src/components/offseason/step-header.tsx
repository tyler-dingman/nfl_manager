'use client';

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
  void canContinue;
  void continueLabel;
  void onContinue;
  void onSkip;
  return null;
}
