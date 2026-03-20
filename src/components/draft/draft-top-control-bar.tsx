'use client';

import { Pause, Play, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DraftMode, DraftSessionDTO } from '@/types/draft';

type DraftTopControlBarProps = {
  mode: DraftMode;
  session: DraftSessionDTO | null;
  speedLevel: 0 | 1 | 2;
  showSettings: boolean;
  onSpeedChange: (value: 0 | 1 | 2) => void;
  onTogglePause: () => void;
  onStartDraft: () => void;
  onToggleSettings: () => void;
};

const speedLabel = (speedLevel: number) => {
  if (speedLevel === 0) return 'Slow';
  if (speedLevel === 2) return 'Fast';
  return 'Normal';
};

export function DraftTopControlBar({
  mode,
  session,
  speedLevel,
  showSettings,
  onSpeedChange,
  onTogglePause,
  onStartDraft,
  onToggleSettings,
}: DraftTopControlBarProps) {
  const currentPick = session?.picks[session.currentPickIndex];

  return (
    <section className="rounded-2xl border border-border bg-white px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {mode === 'real' ? 'Real Draft' : 'Mock Draft'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Draft Room</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            2026 NFL Draft
            {currentPick ? ` • Round ${currentPick.round} • Pick ${currentPick.overall}` : ' • Ready to begin'}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="flex items-center gap-2 rounded-full border border-border bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground">Speed</span>
            <input
              className="w-28 sm:w-32"
              type="range"
              min={0}
              max={2}
              step={1}
              value={speedLevel}
              onChange={(event) => onSpeedChange(Number(event.target.value) as 0 | 1 | 2)}
            />
            <span className="text-xs font-semibold text-foreground">{speedLabel(speedLevel)}</span>
          </div>

          <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={onToggleSettings}>
            <Settings2 className="h-4 w-4" />
            Settings
          </Button>

          {!session ? (
            <Button type="button" size="sm" onClick={onStartDraft}>
              Start Draft
            </Button>
          ) : (
            <Button type="button" size="sm" className="gap-2" onClick={onTogglePause}>
              {session.isPaused ? (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {showSettings ? (
        <div
          className={cn(
            'mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:grid-cols-3',
          )}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Draft Clock
            </p>
            <p className="mt-1">User picks get 90 seconds before autopick triggers.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Trade Chaos
            </p>
            <p className="mt-1">Draft-day calls surface around premium picks and on-the-clock pressure.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Board Mode
            </p>
            <p className="mt-1">Prospects are ranked with live need, value, and run-risk context.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
