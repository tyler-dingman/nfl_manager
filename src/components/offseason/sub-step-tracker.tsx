'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  substeps: string[];
  completed: string[];
  onComplete: (substep: string) => void;
};

export function SubStepTracker({ substeps, completed, onComplete }: Props) {
  return (
    <div className="mb-4 rounded-xl border border-border bg-slate-50 p-3">
      <div className="space-y-2">
        {substeps.map((substep) => {
          const isDone = completed.includes(substep);
          return (
            <button
              key={substep}
              type="button"
              onClick={() => onComplete(substep)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-white"
            >
              <span className="text-sm text-foreground">{substep}</span>
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full border',
                  isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300',
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
