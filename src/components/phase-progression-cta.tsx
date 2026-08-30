'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { OFFSEASON_STEPS, type OffseasonStepId } from '@/features/experience/offseason-steps';
import { getRouteForStep } from '@/features/experience/experience-utils';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useSaveStore } from '@/features/save/save-store';
import { cn } from '@/lib/utils';

type Props = {
  currentStep: OffseasonStepId;
  completedSteps: string[];
};

export function PhaseProgressionCTA({ currentStep, completedSteps }: Props) {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const completeCurrentStep = useExperienceStore((state) => state.completeCurrentStep);
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);

  const currentIndex = OFFSEASON_STEPS.findIndex((step) => step.id === currentStep);
  const isFinalStep = currentIndex === OFFSEASON_STEPS.length - 1;
  const nextStep = OFFSEASON_STEPS[currentIndex + 1];

  const getNextPhaseLabel = () => {
    if (isFinalStep) return 'Season Recap';
    switch (currentStep) {
      case 'manage':
        return 'Free Agency';
      case 'free-agency':
        return 'Draft';
      case 'draft':
        return 'Season Recap';
      default:
        return 'Next Phase';
    }
  };

  const handleContinue = () => {
    if (isFinalStep) {
      // Navigate to offseason recap
      router.push('/offseason-recap');
      return;
    }

    if (saveId) {
      recordProgressEvent({
        saveId,
        step: currentStep,
        eventKey: `continue:${currentStep}:bottom-cta`,
        complete: true,
      });
    }

    const nextStepId = completeCurrentStep();
    if (nextStepId) {
      router.push(getRouteForStep(nextStepId));
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Continue to {getNextPhaseLabel()}</p>
            <p className="text-xs text-muted-foreground">
              {isFinalStep
                ? 'Review your offseason performance'
                : `Complete ${OFFSEASON_STEPS[currentIndex]?.label}`}
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            className="h-12 shrink-0 rounded-full px-6 text-sm font-semibold"
            onClick={handleContinue}
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
