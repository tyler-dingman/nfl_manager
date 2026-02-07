'use client';

import * as React from 'react';

import FalcoAvatar from '@/components/falco/falco-avatar';
import { Button } from '@/components/ui/button';
import type { FalcoAlertItem } from '@/features/draft/falco-alert-store';
import { useFalcoAlertStore } from '@/features/draft/falco-alert-store';
import { cn } from '@/lib/utils';

const accentMap: Record<FalcoAlertItem['type'], string> = {
  FREE_FALL: 'border-l-4 border-amber-400',
  POSITION_RUN: 'border-l-4 border-sky-400',
  VALUE_STEAL: 'border-l-4 border-emerald-400',
  RISKY_REACH: 'border-l-4 border-rose-400',
  CAP_CRISIS: 'border-l-4 border-rose-500',
  BIG_SIGNING: 'border-l-4 border-emerald-500',
  BIG_TRADE: 'border-l-4 border-indigo-500',
};

export default function FalcoAlertToast() {
  const activeAlert = useFalcoAlertStore((state) => state.activeAlert);
  const dismissActive = useFalcoAlertStore((state) => state.dismissActive);
  const [isPaused, setIsPaused] = React.useState(false);

  React.useEffect(() => {
    if (!activeAlert || isPaused) return;
    const timer = window.setTimeout(() => {
      dismissActive();
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activeAlert, dismissActive, isPaused]);

  if (!activeAlert) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-white p-4 shadow-lg transition',
        accentMap[activeAlert.type],
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-start gap-3">
        <FalcoAvatar size={28} />
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {activeAlert.title ?? 'Falco Alert'}
          </p>
          {activeAlert.lines && activeAlert.lines.length > 0 ? (
            <div className="mt-2 space-y-1 text-sm font-semibold text-foreground">
              {activeAlert.lines.map((line, index) => (
                <p key={`${activeAlert.id}-line-${index}`}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm font-semibold text-foreground">{activeAlert.message}</p>
          )}
          <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {activeAlert.type.replace('_', ' ')}
          </span>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={dismissActive}>
          ✕
        </Button>
      </div>
    </div>
  );
}
