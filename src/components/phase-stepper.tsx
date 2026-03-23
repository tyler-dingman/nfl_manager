'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';

import { OFFSEASON_STEPS, type OffseasonStepId } from '@/features/experience/offseason-steps';
import { useExperienceStore } from '@/features/experience/experience-store';
import { useOffseasonProgressStore } from '@/features/experience/offseason-progress-store';
import { useTeamStore } from '@/features/team/team-store';
import { cn } from '@/lib/utils';

type Props = {
  currentStep: OffseasonStepId;
  completedSteps: string[];
};

export function PhaseStepper({ currentStep, completedSteps }: Props) {
  const currentIndex = OFFSEASON_STEPS.findIndex((step) => step.id === currentStep);
  const selectedTeam = useTeamStore((state) => state.teams.find((team) => team.id === state.selectedTeamId));
  const accentColor = selectedTeam?.color_primary ?? '#0f766e';
  const router = useRouter();
  const completeCurrentStep = useExperienceStore((state) => state.completeCurrentStep);
  const recordProgressEvent = useOffseasonProgressStore((state) => state.recordEvent);

  const isStepAccessible = (index: number) => {
    if (index === 0) return true;
    if (index === 1) return currentIndex >= 0;
    if (index === 2) return currentIndex >= 1;
    return false;
  };

  return (
    <div className="md:hidden flex items-center justify-center gap-1 px-4 pt-4 pb-0">
      {OFFSEASON_STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const accessible = isStepAccessible(index);

        const onStepClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
          if (!accessible) {
            event.preventDefault();
            return;
          }

          const nextIndex = index;
          if (nextIndex === currentIndex + 1) {
            if (recordProgressEvent && completeCurrentStep) {
              if (history.state?.idx || history.state?.idx === 0) {
                // no-op
              }
            }
            const next = completeCurrentStep();
            if (next) {
              router.push(step.route);
              if (typeof window !== 'undefined' && window?.location) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }
            event.preventDefault();
            return;
          }

          // history backward/forward: simply route
          if (step.route !== router.pathname) {
            router.push(step.route);
          }
        };

        return (
          <div key={step.id} className="flex items-center">
            <Link
              href={accessible ? step.route : '#'}
              onClick={onStepClick}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                {
                  'text-black': !isCurrent,
                  'text-white': isCurrent,
                },
              )}
              style={{
                border: `1px solid ${isCurrent || isCompleted ? accentColor : '#d4d4d8'}`,
                backgroundColor: isCurrent
                  ? accentColor
                  : isCompleted
                    ? `${accentColor}33`
                    : '#fff',
              }}
              onClick={(e) => {
                if (!isAccessible) {
                  e.preventDefault();
                }
              }}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3 w-3" style={{ color: accentColor }} />
              ) : (
                <Circle className="h-3 w-3" style={{ color: isCurrent ? '#ffffff' : '#94a3b8' }} />
              )}
              <span>{step.label}</span>
            </Link>
            {index < OFFSEASON_STEPS.length - 1 && (
              <div
                className="mx-2 h-px w-4"
                style={{
                  backgroundColor: index < currentIndex ? accentColor : '#d4d4d8',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}