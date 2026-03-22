'use client';

import * as React from 'react';

import rosterIllustration from '@/assets/illustrations/illustration-roster-management.svg';
import freeAgencyIllustration from '@/assets/illustrations/illustration-free-agency.svg';
import draftIllustration from '@/assets/illustrations/illustration-draft.svg';
import OnboardingStep from '@/components/onboarding/OnboardingStep';
import { cn } from '@/lib/utils';

type OnboardingModalProps = {
  open: boolean;
  teamName: string;
  primaryColor?: string | null;
  primaryTextColor?: string;
  currentStep: number;
  totalSteps: number;
  onContinue: () => void;
  onSkip: () => void;
  onPrevious: () => void;
};

type StepConfig = {
  title: string;
  description: string;
  secondaryLine: string;
  illustration: typeof rosterIllustration;
};

const getTeamNickname = (teamName: string) => teamName.trim().split(/\s+/).at(-1) ?? teamName;

export default function OnboardingModal({
  open,
  teamName,
  primaryColor,
  primaryTextColor,
  currentStep,
  totalSteps,
  onContinue,
  onSkip,
  onPrevious,
}: OnboardingModalProps) {
  const [renderedStep, setRenderedStep] = React.useState(currentStep);
  const [transitionState, setTransitionState] = React.useState<'idle' | 'exit' | 'enter'>('idle');
  const [transitionDirection, setTransitionDirection] = React.useState<'forward' | 'backward'>(
    'forward',
  );
  const touchStartXRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setRenderedStep(currentStep);
      setTransitionState('idle');
      return;
    }
    if (currentStep === renderedStep) return;

    setTransitionDirection(currentStep > renderedStep ? 'forward' : 'backward');
    setTransitionState('exit');

    const swapTimer = window.setTimeout(() => {
      setRenderedStep(currentStep);
      setTransitionState('enter');
    }, 110);

    const settleTimer = window.setTimeout(() => {
      setTransitionState('idle');
    }, 220);

    return () => {
      window.clearTimeout(swapTimer);
      window.clearTimeout(settleTimer);
    };
  }, [currentStep, open, renderedStep]);

  const steps: StepConfig[] = React.useMemo(
    () => [
      {
        title: 'Set Your Foundation',
        description:
          'You’re over the cap — tough decisions start now.\n\nRe-sign key players, cut expensive contracts, and explore trade options to free up space. Every move impacts your flexibility heading into free agency.',
        secondaryLine: 'Smart cap management separates contenders from rebuilds.',
        illustration: rosterIllustration,
      },
      {
        title: 'Attack Free Agency',
        description:
          'Fill your biggest needs before the draft.\n\nTarget impact players, uncover hidden value, and build depth where it matters most. The right signings can instantly boost your team’s OVR.',
        secondaryLine: 'Build smart so you’re not forced into reaching on draft day.',
        illustration: freeAgencyIllustration,
      },
      {
        title: `Build the Future of the ${getTeamNickname(teamName)}`,
        description:
          'Draft the next generation of your franchise.\n\nGo best player available or draft for need — every pick shapes your long-term success.',
        secondaryLine: 'Great teams aren’t built overnight — they’re drafted.',
        illustration: draftIllustration,
      },
    ],
    [teamName],
  );

  const activeStep = steps[renderedStep] ?? steps[0];

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;

    if (startX === null || endX === null) return;
    const delta = endX - startX;
    if (Math.abs(delta) < 40) return;

    if (delta < 0 && currentStep < totalSteps - 1) {
      onContinue();
      return;
    }

    if (delta > 0 && currentStep > 0) {
      onPrevious();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-[2px]">
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-white/50 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.28)] transition-all duration-200 ease-out animate-in fade-in zoom-in-95"
        role="dialog"
        aria-modal="true"
        aria-label="Five Wide onboarding"
      >
        <div className="relative overflow-hidden px-5 py-5 sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-100/80 to-transparent" />
          <div
            className={cn(
              'relative transition-all duration-200 ease-out',
              transitionState === 'idle' && 'translate-x-0 opacity-100',
              transitionState === 'enter' && 'translate-x-0 opacity-100',
              transitionState === 'exit' &&
                (transitionDirection === 'forward'
                  ? '-translate-x-3 opacity-0'
                  : 'translate-x-3 opacity-0'),
            )}
          >
            <OnboardingStep
              illustration={activeStep.illustration}
              title={activeStep.title}
              description={activeStep.description}
              secondaryLine={activeStep.secondaryLine}
              currentStep={currentStep}
              totalSteps={totalSteps}
              isFinalStep={currentStep === totalSteps - 1}
              onContinue={onContinue}
              onSkip={onSkip}
              primaryColor={primaryColor}
              primaryTextColor={primaryTextColor}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
