'use client';

import * as React from 'react';
import Image from 'next/image';
import { ChevronDown, Pencil, Search } from 'lucide-react';

import { ProspectIndicators } from '@/components/draft/prospect-indicators';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DraftBoardEntry } from '@/lib/draft-board';
import type { DraftRun } from '@/lib/draft-intelligence';
import { buildProspectIndicators, buildProspectDetailsModel } from '@/lib/draft-prospect-details';
import { getCollegeLogoUrl } from '@/server/collegeLogos';
import { cn } from '@/lib/utils';

type LiveDraftBoardProps = {
  entries: DraftBoardEntry[];
  teamNeeds: string[];
  activeRuns?: DraftRun[];
  onInspectPlayer?: (playerId: string) => void;
  onDraftPlayer?: (playerId: string) => void;
  canDraft: boolean;
};

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

const getCollegeBadgeText = (collegeName?: string | null) => {
  if (!collegeName) return null;
  const normalized = collegeName.replace(/\([^)]*\)/g, '').trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  const initials = words
    .filter((word) => word.toLowerCase() !== 'of' && word.toLowerCase() !== 'state')
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return initials || words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('');
};

const ProspectAvatar = ({
  headshotUrl,
  name,
  firstName,
  lastName,
  collegeLogoUrl,
  collegeName,
}: {
  headshotUrl?: string | null;
  name: string;
  firstName: string;
  lastName: string;
  collegeLogoUrl?: string | null;
  collegeName?: string | null;
}) => {
  const collegeBadgeText = getCollegeBadgeText(collegeName);

  return (
    <div className="relative h-10 w-10 shrink-0">
      {headshotUrl ? (
        <Image
          src={headshotUrl}
          alt={name}
          width={40}
          height={40}
          className="h-10 w-10 rounded-full object-cover object-top"
          unoptimized
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-100 text-xs font-semibold text-slate-600">
          {firstName.charAt(0)}
          {lastName.charAt(0)}
        </div>
      )}
      {collegeLogoUrl || collegeBadgeText ? (
        <div className="absolute -bottom-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-white bg-white px-1 shadow-sm">
          {collegeLogoUrl ? (
            <Image
              src={collegeLogoUrl}
              alt=""
              width={14}
              height={14}
              className="h-3.5 w-3.5 rounded-full object-contain"
              unoptimized
            />
          ) : (
            <span className="text-[8px] font-bold uppercase leading-none text-slate-700">
              {collegeBadgeText}
            </span>
          )}
        </div>
      ) : null}
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
  const [positionFilter, setPositionFilter] =
    React.useState<(typeof positionOptions)[number]>('All');

  const filteredEntries = React.useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const next = entries.filter((entry) => {
      const fullName = `${entry.player.firstName} ${entry.player.lastName}`.toLowerCase();
      const matchesQuery =
        lowerQuery.length === 0 ||
        fullName.includes(lowerQuery) ||
        entry.player.college?.toLowerCase().includes(lowerQuery);
      const matchesPosition =
        positionFilter === 'All' || normalizePosition(entry.player.position) === positionFilter;
      return matchesQuery && matchesPosition;
    });

    return next.slice().sort((left, right) => {
      const leftRank = left.player.rank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.player.rank ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return (
        (right.player.rating ?? right.player.maddenRating ?? 0) -
        (left.player.rating ?? left.player.maddenRating ?? 0)
      );
    });
  }, [entries, positionFilter, query]);

  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Prospect Board
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Best Remaining</h2>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search prospects"
                className="h-10 rounded-full border border-border bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-400"
              />
            </label>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  {positionFilter} <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {positionOptions.map((position) => (
                  <DropdownMenuItem
                    key={position}
                    onClick={() => setPositionFilter(position)}
                    className={positionFilter === position ? 'bg-accent' : ''}
                  >
                    {position}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {filteredEntries.map((entry, index) => {
          const playerName = `${entry.player.firstName} ${entry.player.lastName}`;
          const detailsModel = buildProspectDetailsModel({
            player: entry.player,
            boardEntry: entry,
            teamNeeds,
            activeRuns,
          });
          const indicators = buildProspectIndicators({
            player: entry.player,
            boardEntry: entry,
            teamNeeds,
            activeRuns,
          });
          const visibleIndicators = indicators.filter((indicator) => indicator.key !== 'needs-dev');
          const topRightIndicators = visibleIndicators.slice(0, 2);
          const rowIndicators = visibleIndicators.slice(topRightIndicators.length);
          const collegeLogoUrl = getCollegeLogoUrl(detailsModel.school);
          const summaryLine = `A ${detailsModel.fitScore >= 75 ? 'top-tier' : 'developmental'} ${entry.player.position} prospect from ${detailsModel.school}, ${detailsModel.archetype.toLowerCase()} offers ${detailsModel.fitScore >= 75 ? 'premium draft value' : 'intriguing traits and room to grow'} in a ${entry.player.height ?? 'pro-ready'}${entry.player.weight ? `, ${entry.player.weight} lbs` : ''} build.`;

          return (
            <div
              key={entry.player.id}
              role="button"
              tabIndex={0}
              className="flex w-full cursor-pointer flex-col gap-2 px-4 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:px-5"
              onClick={() => onInspectPlayer?.(entry.player.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onInspectPlayer?.(entry.player.id);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex min-w-[32px] shrink-0 flex-col items-center justify-start pt-0.5 text-slate-400">
                  <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Rank
                  </span>
                  <span className="mt-0.5 text-[16px] font-bold leading-none text-slate-700">
                    {entry.player.rank ?? index + 1}
                  </span>
                </div>
                <div className="shrink-0">
                  <ProspectAvatar
                    headshotUrl={entry.player.headshotUrl}
                    name={playerName}
                    firstName={entry.player.firstName}
                    lastName={entry.player.lastName}
                    collegeLogoUrl={collegeLogoUrl}
                    collegeName={detailsModel.school}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-foreground sm:text-sm">
                      {playerName}
                    </p>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {entry.player.position}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] italic leading-4.5 text-muted-foreground sm:text-xs">
                    {summaryLine}
                  </p>
                  <ProspectIndicators indicators={rowIndicators} compact className="mt-2" />
                </div>

                <div className="shrink-0">
                  {canDraft ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5 px-2.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDraftPlayer?.(entry.player.id);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Draft
                    </Button>
                  ) : topRightIndicators.length > 0 ? (
                    <ProspectIndicators
                      indicators={topRightIndicators}
                      compact
                      className="max-w-[180px] justify-end"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
