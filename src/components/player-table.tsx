'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';

import PlayerRowActions, { type PlayerRowActionsVariant } from '@/components/player-row-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { PlayerRowDTO } from '@/types/player';

const POSITION_FILTERS = [
  'All',
  'QB',
  'RB',
  'WR',
  'TE',
  'OL',
  'DL',
  'LB',
  'CB',
  'S',
  'K',
  'P',
] as const;

const DRAFT_FILTERS = ['All', 'Available', 'Drafted'] as const;

type DraftFilter = (typeof DRAFT_FILTERS)[number];

export type PlayerTableVariant = PlayerRowActionsVariant;

type PlayerColumnDef = ColumnDef<PlayerRowDTO> & {
  meta?: {
    mobileHidden?: boolean;
  };
};

type PlayerTableProps = {
  data: PlayerRowDTO[];
  variant: PlayerTableVariant;
  onTheClockForUserTeam?: boolean;
  onCutPlayer?: (player: PlayerRowDTO) => void;
  onTradePlayer?: (player: PlayerRowDTO) => void;
  onOfferPlayer?: (player: PlayerRowDTO) => void;
  onDraftPlayer?: (player: PlayerRowDTO) => void;
  onResignPlayer?: (player: PlayerRowDTO) => void;
  onRenegotiatePlayer?: (player: PlayerRowDTO) => void;
  onSelectTradePlayer?: (player: PlayerRowDTO) => void;
};

const statusVariantMap: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  active: 'success',
  injured: 'warning',
  'practice squad': 'secondary',
  free: 'outline',
  'free agent': 'outline',
  waived: 'destructive',
  signed: 'success',
};

function getInitials(player: PlayerRowDTO) {
  return `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase();
}

function formatName(player: PlayerRowDTO) {
  return `${player.firstName} ${player.lastName}`;
}

const formatMillions = (value: number) => `$${value.toFixed(1)}M`;

const parseCapHitValue = (player: PlayerRowDTO) => {
  if (player.capHitValue !== undefined) return player.capHitValue;
  const parsed = Number(player.capHit.replace(/[^0-9.]/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
};

function PositionFilterBar({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {POSITION_FILTERS.map((position) => (
        <Button
          key={position}
          type="button"
          variant={active === position ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          onClick={() => onSelect(position)}
        >
          {position}
        </Button>
      ))}
    </div>
  );
}

export function PlayerTable({
  data,
  variant,
  onTheClockForUserTeam = false,
  onCutPlayer,
  onTradePlayer,
  onOfferPlayer,
  onDraftPlayer,
  onResignPlayer,
  onRenegotiatePlayer,
  onSelectTradePlayer,
}: PlayerTableProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  const [positionFilter, setPositionFilter] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [draftFilter, setDraftFilter] = React.useState<DraftFilter>('All');
  const [sorting, setSorting] = React.useState<SortingState>(
    variant === 'roster' ? [{ id: 'capHitValue', desc: true }] : [],
  );

  React.useEffect(() => {
    if (variant === 'roster') {
      setSorting([{ id: 'capHitValue', desc: true }]);
    } else {
      setSorting([]);
    }
  }, [variant]);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const updateMobileState = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    updateMobileState(mediaQuery);
    mediaQuery.addEventListener('change', updateMobileState);

    return () => {
      mediaQuery.removeEventListener('change', updateMobileState);
    };
  }, []);

  const filteredData = React.useMemo(() => {
    return data.filter((player) => {
      const matchesPosition = positionFilter === 'All' || player.position === positionFilter;
      const matchesSearch =
        searchQuery.trim().length === 0 ||
        formatName(player).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDraftFilter =
        variant !== 'draft' ||
        draftFilter === 'All' ||
        (draftFilter === 'Available' && !player.isDrafted) ||
        (draftFilter === 'Drafted' && player.isDrafted);

      return matchesPosition && matchesSearch && matchesDraftFilter;
    });
  }, [data, positionFilter, searchQuery, draftFilter, variant]);

  const columns = React.useMemo<PlayerColumnDef[]>(() => {
    if (variant === 'draft') {
      return [
        {
          accessorKey: 'rank',
          header: 'Rank',
          meta: { mobileHidden: true },
          cell: ({ row }) => (
            <span className="text-sm font-semibold text-foreground">
              {row.original.rank ?? '-'}
            </span>
          ),
        },
        {
          accessorKey: 'name',
          header: 'Name',
          cell: ({ row }) => {
            const player = row.original;
            return (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                  {player.headshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.headshotUrl}
                      alt={formatName(player)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(player)
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{formatName(player)}</p>
                  <p className="text-xs text-muted-foreground md:hidden">
                    {player.position} · {player.college ?? '—'}
                  </p>
                </div>
              </div>
            );
          },
        },
        {
          accessorKey: 'position',
          header: 'Pos',
          meta: { mobileHidden: true },
          cell: ({ row }) => (
            <span className="text-sm font-medium text-foreground">{row.original.position}</span>
          ),
        },
        {
          accessorKey: 'college',
          header: 'College',
          meta: { mobileHidden: true },
          cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">{row.original.college ?? '—'}</span>
          ),
        },
        {
          accessorKey: 'grade',
          header: 'Grade',
          meta: { mobileHidden: true },
          cell: ({ row }) => (
            <span className="text-sm font-semibold text-foreground">
              {row.original.grade ?? '—'}
            </span>
          ),
        },
        {
          accessorKey: 'projectedRound',
          header: 'Projected Rd',
          meta: { mobileHidden: true },
          cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
              {row.original.projectedRound ?? '—'}
            </span>
          ),
        },
      ];
    }

    return [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => {
          const player = row.original;
          const isCut = player.status.toLowerCase() === 'cut';
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                {player.headshotUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.headshotUrl}
                    alt={formatName(player)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(player)
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{formatName(player)}</p>
                  {isCut ? (
                    <Badge variant="destructive" className="text-[10px] uppercase">
                      Cut
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground md:hidden">{player.position}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'position',
        header: 'Pos',
        meta: { mobileHidden: true },
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground">{row.original.position}</span>
        ),
      },
      {
        accessorKey: 'contractYearsRemaining',
        header: 'Contract',
        meta: { mobileHidden: true },
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.contractYearsRemaining} yrs
          </span>
        ),
      },
      {
        accessorKey: 'capHitValue',
        id: 'capHitValue',
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Cap Hit
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        meta: { mobileHidden: false },
        accessorFn: (row) => parseCapHitValue(row),
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-foreground">
            {formatMillions(parseCapHitValue(row.original))}
          </span>
        ),
      },
      {
        accessorKey: 'capSavings',
        header: 'Cap Savings',
        meta: { mobileHidden: false },
        cell: ({ row }) => {
          const capHitValue = parseCapHitValue(row.original);
          const deadCap = row.original.deadCap ?? 0;
          const savings = Math.max(0, capHitValue - deadCap);
          return (
            <span
              className={cn(
                'text-sm font-semibold',
                savings > 0 ? 'text-emerald-600' : 'text-muted-foreground',
              )}
            >
              {savings > 0 ? `+${formatMillions(savings)}` : formatMillions(0)}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { mobileHidden: true },
        cell: ({ row }) => {
          const statusKey = row.original.status.toLowerCase();
          return (
            <div className="flex items-center gap-2">
              <Badge variant={statusVariantMap[statusKey] ?? 'outline'}>
                {row.original.status}
              </Badge>
              {row.original.signedTeamLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.original.signedTeamLogoUrl}
                  alt={`${row.original.signedTeamAbbr ?? 'Team'} logo`}
                  className="h-5 w-5"
                />
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const player = row.original;
          return (
            <PlayerRowActions
              player={player}
              variant={variant}
              onTheClockForUserTeam={onTheClockForUserTeam}
              onCutPlayer={onCutPlayer}
              onTradePlayer={onTradePlayer}
              onOfferPlayer={onOfferPlayer}
              onDraftPlayer={onDraftPlayer}
              onResignPlayer={onResignPlayer}
              onRenegotiatePlayer={onRenegotiatePlayer}
              onSelectTradePlayer={onSelectTradePlayer}
            />
          );
        },
      },
    ];
  }, [
    onCutPlayer,
    onDraftPlayer,
    onOfferPlayer,
    onResignPlayer,
    onRenegotiatePlayer,
    onSelectTradePlayer,
    onTheClockForUserTeam,
    onTradePlayer,
    variant,
  ]);

  const visibleColumns = React.useMemo(
    () => columns.filter((column) => !(isMobile && column.meta?.mobileHidden)),
    [columns, isMobile],
  );

  const table = useReactTable({
    data: filteredData,
    columns: visibleColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  });

  const resetFilters = () => {
    setPositionFilter('All');
    setSearchQuery('');
    setDraftFilter('All');
  };

  return (
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
        {variant === 'draft' && (
          <div className="flex flex-wrap gap-2">
            {DRAFT_FILTERS.map((filter) => (
              <Button
                key={filter}
                type="button"
                variant={draftFilter === filter ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 rounded-full px-4 text-xs"
                onClick={() => setDraftFilter(filter)}
              >
                {filter}
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse md:min-w-[720px]">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'px-4 py-2 sm:px-6',
                      header.column.id === 'actions' && 'w-[88px] text-right',
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isCut = row.original.status.toLowerCase() === 'cut';
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-t border-border hover:bg-slate-50/60',
                    isCut ? 'opacity-60' : null,
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-1.5 align-middle text-sm sm:px-6',
                        cell.column.id === 'actions' && 'w-[88px] text-right',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filteredData.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
          No players match the current filters.
        </div>
      )}
    </div>
  );
}
