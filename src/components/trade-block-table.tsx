'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowUpDown, MoreHorizontal } from 'lucide-react';

import { PositionFilterBar } from '@/components/player-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSaveStore } from '@/features/save/save-store';
import { useTeamStore } from '@/features/team/team-store';
import type { TradeBlockRow } from '@/types/trade-block';

type TradeBlockSortKey = 'score' | 'name' | 'pos' | 'age' | 'rating' | 'fits';

const renderSortableHeader = (
  label: string,
  key: TradeBlockSortKey,
  onToggle: (key: TradeBlockSortKey) => void,
) => (
  <button
    type="button"
    className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase text-muted-foreground"
    onClick={() => onToggle(key)}
  >
    {label}
    <ArrowUpDown className="h-3 w-3" />
  </button>
);

const normalizePositionToken = (token: string) => {
  const normalized = token.trim().toUpperCase();
  if (normalized === 'EDGE') return 'ED';
  if (normalized === 'FS' || normalized === 'SS') return 'S';
  if (normalized === 'IDL' || normalized === 'DT') return 'DL';
  return normalized;
};

const matchesPositionFilter = (playerPosition: string, filter: string) => {
  if (filter === 'All') return true;
  const raw = playerPosition?.toUpperCase() ?? '';
  const parts = raw.split('/').map((part) => normalizePositionToken(part));

  if (filter === 'OL') {
    return parts.some((part) =>
      ['OL', 'OT', 'IOL', 'C', 'G', 'LG', 'RG', 'RT', 'LT'].includes(part),
    );
  }

  const normalizedFilter = normalizePositionToken(filter);
  return parts.some((part) => part === normalizedFilter);
};

export function TradeBlockTable({
  data,
  loading = false,
  onExplorePlayer,
}: {
  data: TradeBlockRow[];
  loading?: boolean;
  onExplorePlayer: (player: TradeBlockRow) => void;
}) {
  const teams = useTeamStore((state) => state.teams);
  const userTeamAbbr = useSaveStore((state) => state.teamAbbr);
  const [positionFilter, setPositionFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<{ key: TradeBlockSortKey; desc: boolean }>({
    key: 'rating',
    desc: true,
  });

  const teamLookup = useMemo(
    () => new Map(teams.map((team) => [team.abbr, team])),
    [teams],
  );

  const filteredPlayers = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return data
      .filter((player) => {
        const matchesPosition = matchesPositionFilter(player.position, positionFilter);
        const matchesSearch =
          search.length === 0 ||
          `${player.firstName} ${player.lastName}`.toLowerCase().includes(search);
        return matchesPosition && matchesSearch;
      })
      .sort((left, right) => {
        const compareStrings = (a: string, b: string) => a.localeCompare(b);
        const compareNumbers = (
          a: number | null | undefined,
          b: number | null | undefined,
        ) => {
          const normalizedA = a ?? null;
          const normalizedB = b ?? null;
          if (normalizedA === null && normalizedB !== null) return 1;
          if (normalizedA !== null && normalizedB === null) return -1;
          if (normalizedA === null && normalizedB === null) return 0;
          return (normalizedA ?? 0) - (normalizedB ?? 0);
        };

        let result = 0;

        switch (sort.key) {
          case 'name':
            result = compareStrings(
              `${left.firstName} ${left.lastName}`,
              `${right.firstName} ${right.lastName}`,
            );
            break;
          case 'pos':
            result = compareStrings(left.position, right.position);
            break;
          case 'age':
            result = compareNumbers(left.age, right.age);
            break;
          case 'rating':
            result = compareNumbers(left.rating, right.rating);
            break;
          case 'fits':
            result = compareNumbers(left.potentialFits.length, right.potentialFits.length);
            break;
          case 'score':
          default:
            result = compareNumbers(left.tradeBlockScore, right.tradeBlockScore);
            break;
        }

        if (result === 0) {
          result = compareStrings(
            `${left.firstName} ${left.lastName}`,
            `${right.firstName} ${right.lastName}`,
          );
        }

        return sort.desc ? -result : result;
      });
  }, [data, positionFilter, searchQuery, sort]);

  const toggleSort = (key: TradeBlockSortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : { key, desc: key !== 'name' && key !== 'pos' },
    );
  };

  const resetFilters = () => {
    setPositionFilter('All');
    setSearchQuery('');
    setSort({ key: 'rating', desc: true });
  };

  const actionHeaderClass =
    'sticky right-0 z-20 w-[136px] min-w-[136px] border-l border-slate-200 bg-slate-50 pl-4 pr-2 text-left [box-shadow:inset_1px_0_0_rgba(226,232,240,1),-8px_0_14px_-14px_rgba(15,23,42,0.28)] md:static md:w-[88px] md:min-w-0 md:border-l-0 md:bg-transparent md:px-6 md:text-right md:shadow-none md:[box-shadow:none]';
  const actionCellClass =
    'sticky right-0 z-10 w-[136px] min-w-[136px] border-l border-slate-200 bg-white pl-4 pr-2 text-left [box-shadow:inset_1px_0_0_rgba(226,232,240,1),-8px_0_14px_-14px_rgba(15,23,42,0.28)] md:static md:w-[88px] md:min-w-0 md:border-l-0 md:bg-transparent md:px-6 md:text-right md:shadow-none md:[box-shadow:none]';

  return (
    <div className="max-h-[70vh] overflow-y-auto">
      <div className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PositionFilterBar active={positionFilter} onSelect={setPositionFilter} />
            <div className="flex w-full max-w-sm items-center gap-2 sm:w-auto">
              <input
                type="search"
                placeholder="Search players..."
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={resetFilters}>Reset filters</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSearchQuery('')}>Clear search</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="space-y-6 overflow-x-auto pl-4 pr-0 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground md:hidden">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Swipe to see more columns.</span>
          </div>
          {loading && data.length === 0 ? (
            <>
              <table className="w-full border-collapse md:min-w-[940px]">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 sm:px-6">Player</th>
                    <th className="px-4 py-2 sm:px-6">Pos</th>
                    <th className="px-4 py-2 sm:px-6">Age</th>
                    <th className="px-4 py-2 sm:px-6">OVR</th>
                    <th className="px-4 py-2 sm:px-6">Team</th>
                    <th className="px-4 py-2 sm:px-6">Contract</th>
                    <th className="px-4 py-2 sm:px-6">Potential Fits</th>
                    <th className={`px-4 py-2 sm:px-6 ${actionHeaderClass}`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }, (_, index) => (
                    <tr key={`trade-block-skeleton-${index}`} className="border-t border-border">
                      {['w-40', 'w-12', 'w-10', 'w-10', 'w-20', 'w-12'].map(
                        (width, cellIndex) => (
                          <td key={`${index}-${cellIndex}`} className="px-4 py-3 align-middle sm:px-6">
                            <div className={`h-4 animate-pulse rounded bg-slate-200/80 ${width}`} />
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 text-xs text-muted-foreground sm:px-6">
                Loading players...
              </div>
            </>
          ) : (
            <>
              <table className="w-full border-collapse md:min-w-[940px]">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 sm:px-6">
                      {renderSortableHeader('Player', 'name', toggleSort)}
                    </th>
                    <th className="px-4 py-2 sm:px-6">
                      {renderSortableHeader('Pos', 'pos', toggleSort)}
                    </th>
                    <th className="px-4 py-2 sm:px-6">
                      {renderSortableHeader('Age', 'age', toggleSort)}
                    </th>
                    <th className="px-4 py-2 sm:px-6">
                      {renderSortableHeader('OVR', 'rating', toggleSort)}
                    </th>
                    <th className="px-4 py-2 sm:px-6">
                      {renderSortableHeader('Potential Fits', 'fits', toggleSort)}
                    </th>
                    <th className={`px-4 py-2 sm:px-6 ${actionHeaderClass}`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player) => (
                    <tr key={player.id} className="border-t border-border hover:bg-slate-50/60">
                      <td className="px-4 py-2 text-sm sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                            {player.headshotUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={player.headshotUrl}
                                alt={`${player.firstName} ${player.lastName}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-foreground">
                              {player.firstName} {player.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground" title={player.tradeBlockReason}>
                              {player.tradeBlockReason}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-muted-foreground sm:px-6">{player.position}</td>
                      <td className="px-4 py-2 text-sm text-muted-foreground sm:px-6">
                        {player.age ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-sm font-semibold text-foreground sm:px-6">
                        {player.rating ?? '—'}
                      </td>
                      <td className="px-4 py-2 sm:px-6">
                        <div className="flex items-center gap-2">
                          {player.potentialFits.map((abbr) => {
                            const team = teamLookup.get(abbr);
                            const isUserTeam = abbr === userTeamAbbr;
                            return (
                              <div
                                key={`${player.id}-${abbr}`}
                                className="flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm"
                                style={{
                                  borderColor: isUserTeam
                                    ? team?.color_primary ?? 'var(--team-primary)'
                                    : undefined,
                                  boxShadow: isUserTeam
                                    ? `0 0 0 1px ${team?.color_primary ?? 'var(--team-primary)'}20`
                                    : undefined,
                                }}
                                title={team?.name ?? abbr}
                              >
                                {team?.logo_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={team.logo_url}
                                    alt={team.name}
                                    className="h-5 w-5 object-contain"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <span className="text-[10px] font-semibold text-muted-foreground">
                                    {abbr}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className={`px-4 py-2 sm:px-6 ${actionCellClass}`}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-[124px] justify-center gap-1.5 text-xs"
                          onClick={() => onExplorePlayer(player)}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                          Trade
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPlayers.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
                  No players match the current filters.
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
