'use client';

import Image from 'next/image';
import { ArrowDown, ArrowUpRight, Sparkles, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DraftBoardEntry } from '@/lib/draft-board';
import { cn } from '@/lib/utils';

type LiveDraftBoardProps = {
  entries: DraftBoardEntry[];
  selectedPlayerId?: string | null;
  onSelectPlayer?: (playerId: string) => void;
  onDraftPlayer?: (playerId: string) => void;
  canDraft: boolean;
};

const tagVariant = (tag: DraftBoardEntry['tags'][number]) => {
  if (tag === 'Best Available') return 'default';
  if (tag === 'Team Need') return 'success';
  if (tag === 'Steal') return 'secondary';
  return 'outline';
};

const valueTone = (delta: number) => {
  if (delta >= 10) return 'text-emerald-700';
  if (delta >= 5) return 'text-amber-700';
  return 'text-muted-foreground';
};

export function LiveDraftBoard({
  entries,
  selectedPlayerId = null,
  onSelectPlayer,
  onDraftPlayer,
  canDraft,
}: LiveDraftBoardProps) {
  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Live Draft Board
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Best Remaining</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
            <Sparkles className="h-3.5 w-3.5" />
            Updates after every pick
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {entries.map((entry, index) => {
          const playerName = `${entry.player.firstName} ${entry.player.lastName}`;
          const isSelected = selectedPlayerId === entry.player.id;
          return (
            <button
              key={entry.player.id}
              type="button"
              className={cn(
                'flex w-full flex-col gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5',
                isSelected ? 'bg-slate-50' : '',
              )}
              onClick={() => onSelectPlayer?.(entry.player.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex min-w-[34px] shrink-0 items-center justify-center text-lg font-bold text-slate-400">
                  {index + 1}
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                  {entry.player.headshotUrl ? (
                    <Image
                      src={entry.player.headshotUrl}
                      alt={playerName}
                      width={44}
                      height={44}
                      className="h-11 w-11 object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-sm font-semibold text-slate-500">
                      {entry.player.firstName.charAt(0)}
                      {entry.player.lastName.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground sm:text-base">{playerName}</p>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {entry.player.position}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.player.college ?? 'College TBD'} · OVR {entry.player.rating ?? entry.player.maddenRating ?? '--'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {entry.tags.map((tag) => (
                      <Badge key={tag} variant={tagVariant(tag)}>
                        {tag}
                      </Badge>
                    ))}
                    {entry.valueDelta > 0 ? (
                      <span className={cn('inline-flex items-center gap-1 text-xs font-medium', valueTone(entry.valueDelta))}>
                        <ArrowDown className="h-3 w-3" />
                        {entry.valueDelta} picks later than expected
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Board
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {entry.boardScore.toFixed(1)}
                  </p>
                </div>
              </div>

              {canDraft ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDraftPlayer?.(entry.player.id);
                    }}
                  >
                    <Star className="h-4 w-4" />
                    Draft
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Tap to spotlight
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
