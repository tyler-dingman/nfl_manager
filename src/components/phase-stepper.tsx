'use client';

import type { OffseasonStepId } from '@/features/experience/offseason-steps';
import { useSaveStore } from '@/features/save/save-store';
import { frontOfficeLifecycle } from '@/lib/front-office-phase';

/** A read-only overview of the shared clock, not an independent onboarding progression. */
export function PhaseStepper(_props: { currentStep: OffseasonStepId; completedSteps: string[] }) {
  const phase = useSaveStore((state) => state.phase);
  const lifecycle = frontOfficeLifecycle(phase);
  const stages = ['SEASON', 'PLAYOFFS', 'OFFSEASON'] as const;
  return (
    <div
      className="fo-phase-stepper flex flex-wrap items-center justify-center gap-3 px-2 py-2"
      aria-label="Franchise lifecycle"
    >
      {stages.map((stage) => (
        <span
          key={stage}
          aria-current={stage === lifecycle.mainPhase ? 'step' : undefined}
          className={
            stage === lifecycle.mainPhase
              ? 'font-semibold text-[var(--fo-interactive-text)]'
              : 'text-muted-foreground'
          }
        >
          {stage === 'SEASON' ? 'Season' : stage === 'PLAYOFFS' ? 'Playoffs' : 'Offseason'}
        </span>
      ))}
    </div>
  );
}
