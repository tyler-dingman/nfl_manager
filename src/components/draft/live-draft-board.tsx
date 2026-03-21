'use client';

import * as React from 'react';
import Image from 'next/image';
import { ArrowUpRight, Search } from 'lucide-react';

import { ProspectIndicators } from '@/components/draft/prospect-indicators';
import { Button } from '@/components/ui/button';
import type { DraftBoardEntry } from '@/lib/draft-board';
import type { DraftRun } from '@/lib/draft-intelligence';
import { buildProspectIndicators } from '@/lib/draft-prospect-details';
import { cn } from '@/lib/utils';

type LiveDraftBoardProps = {
  entries: DraftBoardEntry[];
  teamNeeds: string[];
  activeRuns?: DraftRun[];
  onInspectPlayer?: (playerId: string) => void;
  onDraftPlayer?: (playerId: string) => void;
  canDraft: boolean;
};

type SortKey = 'board' | 'rank' | 'rating' | 'fit';

const normalizePosition = (position: string) => {
  const normalized = position.toUpperCase();
  if (['LT', 'RT', 'OT'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'C', 'IOL', 'OL'].includes(normalized)) return 'IOL';
  if (['EDGE', 'ED', 'DE', 'LE', 'RE'].includes(normalized)) return 'EDGE';
  if (['DT', 'DL', 'NT', 'IDL'].includes(normalized)) return 'DL';
  if (['OLB', 'ILB', 'MLB', 'LB', 'EDGE/LB'].includes(normalized)) return 'LB';
  if (['FS', 'SS', 'S'].includes(normalized)) return 'S';
  return normalized;
};

const positionOptions = [
  'All',
  'QB',
  'RB',
  'WR',
  'TE',
  'OT',
  'IOL',
  'EDGE',
  'DL',
  'LB',
  'CB',
  'S',
] as const;

const ProspectAvatar = ({
  headshotUrl,
  name,
  firstName,
  lastName,
}: {
  headshotUrl?: string | null;
  name: string;
  firstName: string;
  lastName: string;
}) => {
  if (headshotUrl) {
    return (
      <Image
        src={headshotUrl}
        alt={name}
        width={48}
        height={48}
        className="h-12 w-12 rounded-full object-cover object-top"
        unoptimized
      />
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-100 text-sm font-semibold text-slate-600">
      {firstName.charAt(0)}
      {lastName.charAt(0)}
    </div>
  );
};

export function LiveDraftBoard({
  entries,
  teamNeeds,
  activeRuns = [],
  onInspectPlayer,
  onDraftPlayer,
  canDraft,
}: LiveDraftBoardProps) {
  const [query, setQuery] = React.useState('');
  const [positionFilter, setPositionFilter] = React.useState<(typeof positionOptions)[number]>('All');
  const [sortKey, setSortKey] = React.useState<SortKey>('board');

  const filteredEntries = React.useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const next = entries.filter((entry) => {
      const fullName = `${entry.player.firstName} ${entry.player.lastName}`.toLowerCase();
      const matchesQuery =
        lowerQuery.length === 0 ||
        fullName.includes(lowerQuery) ||
        entry.player.college?.toLowerCase().includes(lowerQuery);
      const matchesPosition =
        positionFilter === 'All' ||
        normalizePosition(entry.player.position) === positionFilter;
      return matchesQuery && matchesPosition;
    });

    return next.slice().sort((left, right) => {
      if (sortKey === 'rank') return (left.player.rank ?? 999) - (right.player.rank ?? 999);
      if (sortKey === 'rating') {
        return (right.player.rating ?? right.player.maddenRating ?? 0) - (left.player.rating ?? left.player.maddenRating ?? 0);
      }
      if (sortKey === 'fit') return right.fitScore - left.fitScore;
      return right.boardScore - left.boardScore;
    });
  }, [entries, positionFilter, query, sortKey]);

  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Prospect Board
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Best Remaining</h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search prospects"
                className="h-10 rounded-full border border-border bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>

            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-10 rounded-full border border-border bg-white px-3 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="board">Sort: Board</option>
              <option value="rank">Sort: Rank</option>
              <option value="rating">Sort: Grade</option>
              <option value="fit">Sort: Fit</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {positionOptions.map((position) => (
              <button
                key={position}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  positionFilter === position
                    ? ''
                    : 'border-border bg-white text-slate-600 hover:border-slate-300',
                )}
                style={
                  positionFilter === position
                    ? {
                        backgroundColor: 'var(--team-primary)',
                        borderColor: 'var(--team-primary)',
                        color: 'var(--team-on-primary)',
                      }
                    : undefined
                }
                onClick={() => setPositionFilter(position)}
              >
                {position}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {filteredEntries.map((entry, index) => {
          const playerName = `${entry.player.firstName} ${entry.player.lastName}`;
          const indicators = buildProspectIndicators({
            player: entry.player,
            boardEntry: entry,
            teamNeeds,
            activeRuns,
          });

          return (
            <div
              key={entry.player.id}
              role="button"
              tabIndex={0}
              className="flex w-full cursor-pointer flex-col gap-3 px-4 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:px-5"
              onClick={() => onInspectPlayer?.(entry.player.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onInspectPlayer?.(entry.player.id);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex min-w-[32px] shrink-0 items-center justify-center text-lg font-bold text-slate-300">
                  {index + 1}
                </div>
                <div className="shrink-0">
                  <ProspectAvatar
                    headshotUrl={entry.player.headshotUrl}
                    name={playerName}
                    firstName={entry.player.firstName}
                    lastName={entry.player.lastName}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground sm:text-base">{playerName}</p>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {entry.player.position}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    {entry.player.college ?? 'School TBD'} · Rank {entry.player.rank ?? '--'} · OVR{' '}
                    {entry.player.rating ?? entry.player.maddenRating ?? '--'}
                  </p>
                  <ProspectIndicators indicators={indicators} compact className="mt-3" />
                </div>

                <div className="hidden shrink-0 items-center gap-2 md:flex">
                  {canDraft ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDraftPlayer?.(entry.player.id);
                      }}
                    >
                      Draft
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Scout
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end md:hidden">
                {canDraft ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDraftPlayer?.(entry.player.id);
                    }}
                  >
                    Draft
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Tap for details
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
