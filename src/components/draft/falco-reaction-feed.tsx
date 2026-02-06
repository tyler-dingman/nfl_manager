'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DraftEventDTO = {
  id: string;
  pickNumber: number;
  teamAbbr: string;
  teamLogoUrl?: string | null;
  playerName: string;
  position: string;
  label: string;
  reaction: string;
  createdAt: string;
};

type FalcoReactionFeedProps = {
  events: DraftEventDTO[];
};

const labelStyles: Record<string, string> = {
  VALUE: 'bg-emerald-100 text-emerald-700',
  REACH: 'bg-red-100 text-red-700',
  NEED: 'bg-blue-100 text-blue-700',
  SAFE: 'bg-slate-100 text-slate-600',
  'BUST RISK': 'bg-amber-100 text-amber-700',
};

export function FalcoReactionFeed({ events }: FalcoReactionFeedProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm">
        Falco is watching the board… reactions will appear here.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Draft Feed
        </h3>
      </div>
      <div className="mt-4 max-h-[48vh] space-y-3 overflow-y-auto pr-1">
        {events.map((event) => (
          <div key={event.id} className="rounded-xl border border-border px-3 py-2">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                {event.teamLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={event.teamLogoUrl} alt={event.teamAbbr} className="h-5 w-5" />
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {event.teamAbbr}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Pick {event.pickNumber}: {event.teamAbbr} selects {event.playerName} (
                  {event.position})
                </p>
                <p className="text-xs text-muted-foreground">{event.reaction}</p>
              </div>
              <Badge className={cn('text-[10px]', labelStyles[event.label] ?? labelStyles.SAFE)}>
                {event.label}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
