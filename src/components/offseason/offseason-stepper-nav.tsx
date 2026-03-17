'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, Lock } from 'lucide-react';

import { OFFSEASON_STEPS, type OffseasonStepId } from '@/features/experience/offseason-steps';
import { cn } from '@/lib/utils';

type Props = {
  seasonLabel: string;
  teamName: string;
  currentStep: OffseasonStepId;
  completedSteps: string[];
};

export function OffseasonStepperNav({ seasonLabel, teamName, currentStep, completedSteps }: Props) {
  const currentIndex = OFFSEASON_STEPS.findIndex((step) => step.id === currentStep);

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-border bg-slate-50 p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{seasonLabel}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{teamName}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Step {currentIndex + 1} of {OFFSEASON_STEPS.length}
        </p>
      </div>

      <div className="relative space-y-2 before:absolute before:left-3.5 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-slate-200">
        {OFFSEASON_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStep;
          const isLocked = index > currentIndex;

          return (
            <div key={step.id} className="relative rounded-lg px-2 py-2">
              <div className="flex items-start gap-3">
                <span className="mt-0.5">
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : isLocked ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Circle
                      className={cn('h-4 w-4', isCurrent ? 'text-slate-900' : 'text-slate-400')}
                    />
                  )}
                </span>
                <div>
                  {isLocked ? (
                    <p className="text-sm font-medium text-muted-foreground">{step.label}</p>
                  ) : (
                    <Link
                      className={cn(
                        'text-sm font-semibold',
                        isCurrent ? 'text-foreground' : 'text-muted-foreground',
                      )}
                      href={step.route}
                    >
                      {step.label}
                    </Link>
                  )}
                  {isLocked ? (
                    <p className="text-xs text-muted-foreground">
                      Complete {OFFSEASON_STEPS[currentIndex]?.label} first
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
