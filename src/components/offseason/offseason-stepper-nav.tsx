'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { OFFSEASON_STEPS, type OffseasonStepId } from '@/features/experience/offseason-steps';
import { getRouteForStep } from '@/features/experience/experience-utils';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useSaveStore } from '@/features/save/save-store';
import { cn } from '@/lib/utils';

type Props = {
  seasonLabel: string;
  teamName: string;
  currentStep: OffseasonStepId;
  completedSteps: string[];
};

export function OffseasonStepperNav({ seasonLabel, teamName, currentStep, completedSteps }: Props) {
  const router = useRouter();
  const saveId = useSaveStore((state) => state.saveId);
  const completeCurrentStep = useExperienceStore((state) => state.completeCurrentStep);
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);
  const currentIndex = OFFSEASON_STEPS.findIndex((step) => step.id === currentStep);
  const isFinalStep = currentIndex === OFFSEASON_STEPS.length - 1;

  const handleContinue = () => {
    if (isFinalStep) return;

    if (saveId) {
      recordProgressEvent({
        saveId,
        step: currentStep,
        eventKey: `continue:${currentStep}:stepper`,
        complete: true,
      });
    }

    const nextStep = completeCurrentStep();
    if (nextStep) {
      router.push(getRouteForStep(nextStep));
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-border bg-slate-50 p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{seasonLabel}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{teamName}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Step {currentIndex + 1} of {OFFSEASON_STEPS.length}
        </p>
      </div>

      <div className="space-y-0.5">
        {OFFSEASON_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStep;
          const isLocked = index > currentIndex;

          return (
            <div key={step.id}>
              <div className="relative rounded-lg px-2 py-2">
                <div className="flex items-start gap-3">
                  <span className="relative z-[1] mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 fill-emerald-600 text-white" />
                    ) : isLocked ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Circle
                        className={cn(
                          'h-5 w-5 fill-white',
                          isCurrent ? 'text-slate-900' : 'text-slate-400',
                        )}
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    {isLocked ? (
                      <p className="text-sm font-medium text-muted-foreground">{step.label}</p>
                    ) : (
                      <div className="flex flex-col items-start gap-1.5">
                        <Link
                          className={cn(
                            'text-sm font-semibold',
                            isCurrent ? 'text-foreground' : 'text-muted-foreground',
                          )}
                          href={step.route}
                        >
                          {step.label}
                        </Link>
                        {isCurrent && !isFinalStep ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full px-2.5 text-[11px] font-semibold"
                            onClick={handleContinue}
                          >
                            Continue
                          </Button>
                        ) : null}
                      </div>
                    )}
                    {isLocked ? (
                      <p className="text-xs text-muted-foreground">
                        Complete {OFFSEASON_STEPS[currentIndex]?.label} first
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              {index < OFFSEASON_STEPS.length - 1 ? (
                <div className="ml-[11px] h-5 w-px border-l border-dashed border-slate-300" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
