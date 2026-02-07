import { ChevronRight, ClipboardList, Handshake, PlayCircle, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

type JourneyStep = {
  title: string;
  helper: string;
  icon: typeof Handshake;
  comingSoon?: boolean;
};

const STEPS: JourneyStep[] = [
  {
    title: 'Re-sign / cut / trade players',
    helper: 'Step 1 of 4',
    icon: Handshake,
  },
  {
    title: 'Then move into Free Agency',
    helper: 'Step 2 of 4',
    icon: Users,
  },
  {
    title: 'Then the Draft',
    helper: 'Step 3 of 4',
    icon: ClipboardList,
  },
  {
    title: 'Then 2026 season simulation (coming soon)',
    helper: 'Step 4 of 4',
    icon: PlayCircle,
    comingSoon: true,
  },
];

type OffseasonJourneyProps = {
  currentStep: 1 | 2 | 3 | 4;
  mode: 'compact' | 'full';
  showComingSoon?: boolean;
};

export default function OffseasonJourney({
  currentStep,
  mode,
  showComingSoon = true,
}: OffseasonJourneyProps) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            GM Journey
          </p>
          <p className="text-sm text-muted-foreground">Your offseason roadmap.</p>
        </div>
        {mode === 'full' ? (
          <span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
            Step {currentStep} of 4
            <ChevronRight className="h-3 w-3" />
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          'relative mt-4 grid gap-3',
          mode === 'full' ? 'md:grid-cols-4 md:gap-4' : 'md:grid-cols-2',
        )}
      >
        {mode === 'full' ? (
          <span className="md:before:absolute md:before:left-6 md:before:right-6 md:before:top-6 md:before:h-px md:before:bg-border" />
        ) : null}
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const stepIndex = index + 1;
          const isActive = stepIndex === currentStep;
          return (
            <div
              key={step.title}
              className={cn(
                'relative z-10 flex flex-col gap-2 rounded-xl border border-border bg-slate-50 p-4 transition',
                isActive && 'border-slate-900/30 bg-white shadow-sm',
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.helper}</p>
              {showComingSoon && step.comingSoon ? (
                <span className="w-fit rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  Coming soon
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
