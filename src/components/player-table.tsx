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

export const POSITION_FILTERS = [
  'All',
  'QB',
  'RB',
  'WR',
  'TE',
  'ED',
  'OL',
  'DL',
  'LB',
  'CB',
  'S',
  'K',
  'P',
] as const;

export type PlayerTableVariant = PlayerRowActionsVariant;

type PlayerColumnDef = ColumnDef<PlayerRowDTO> & {
  meta?: {
    mobileHidden?: boolean;
    hidden?: boolean;
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
const formatMarketValue = (value: number) => `$${(value / 1_000_000).toFixed(1)}M`;
const formatSignedMarketValue = (player: PlayerRowDTO) => {
  const years = player.contract?.yearsRemaining ?? player.contractYearsRemaining;
  const apy = player.contract?.apy;
  if (!years || !apy) return null;
  const apyFormatted =
    Math.abs(apy - Math.round(apy)) < 0.05 ? Math.round(apy).toString() : apy.toFixed(1);
  return `${years}year / $${apyFormatted}M APY`;
};

const isSignedPlayer = (player: PlayerRowDTO) =>
  player.status.toLowerCase() === 'signed' || Boolean(player.signedTeamAbbr);
const isCutPlayer = (player: PlayerRowDTO) => player.status.toLowerCase() === 'cut';

const parseCapHitValue = (player: PlayerRowDTO) => {
  if (player.capHitValue !== undefined) return player.capHitValue;
  const parsed = Number(player.capHit.replace(/[^0-9.]/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
};

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

export function PositionFilterBar({
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
  const isDraftVariant = variant === 'draft';
  const [sorting, setSorting] = React.useState<SortingState>(() => {
    if (variant === 'roster') {
      return [
        { id: 'cutSort', desc: true },
        { id: 'capHitValue', desc: true },
      ];
    }
    if (variant === 'freeAgent') {
      return [
        { id: 'marketValue', desc: true },
        { id: 'name', desc: false },
      ];
    }
    return [];
  });

  React.useEffect(() => {
    if (variant === 'roster') {
      setSorting([
        { id: 'cutSort', desc: true },
        { id: 'capHitValue', desc: true },
      ]);
      return;
    }
    if (variant === 'freeAgent') {
      setSorting([
        { id: 'marketValue', desc: true },
        { id: 'name', desc: false },
      ]);
      return;
    }
    setSorting([]);
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
      const matchesPosition = matchesPositionFilter(player.position, positionFilter);
      const matchesSearch =
        searchQuery.trim().length === 0 ||
        formatName(player).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDraftFilter = variant !== 'draft' || !player.isDrafted;

      return matchesPosition && matchesSearch && matchesDraftFilter;
    });
  }, [data, positionFilter, searchQuery, variant]);

  const signedData = React.useMemo(() => {
    if (variant !== 'freeAgent') return [];
    return filteredData
      .filter((player) => isSignedPlayer(player))
      .sort((a, b) => {
        const aSignedAt = a.signedAt ? Date.parse(a.signedAt) : 0;
        const bSignedAt = b.signedAt ? Date.parse(b.signedAt) : 0;
        if (aSignedAt !== bSignedAt) return bSignedAt - aSignedAt;
        const aValue = a.marketValue ?? -1;
        const bValue = b.marketValue ?? -1;
        if (aValue !== bValue) return bValue - aValue;
        return formatName(a).localeCompare(formatName(b));
      });
  }, [filteredData, variant]);

  const availableData = React.useMemo(() => {
    if (variant !== 'freeAgent') return [];
    return filteredData.filter((player) => !isSignedPlayer(player));
  }, [filteredData, variant]);

  const columns = React.useMemo<PlayerColumnDef[]>(() => {
    if (variant === 'draft') {
      return [
        {
          accessorKey: 'rank',
          header: 'Rank',
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
              <div className="flex min-w-0 items-center gap-3">
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
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {formatName(player)}
                  </p>
                  <p className="text-xs text-muted-foreground md:hidden">
                    {player.position} · {player.college ?? '—'}
                  </p>
                </div>
              </div>
            );
          },
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: ({ row }) => {
            const player = row.original;
            const isDisabled = player.isDrafted || !onTheClockForUserTeam;
            const disabledReason = player.isDrafted
              ? 'Prospect already drafted.'
              : !onTheClockForUserTeam
                ? 'Not on the clock.'
                : undefined;

            const button = (
              <Button
                type="button"
                size="sm"
                className="h-8"
                onClick={() => onDraftPlayer?.(player)}
                disabled={isDisabled}
              >
                Draft
              </Button>
            );

            if (disabledReason) {
              return (
                <span className="inline-flex" title={disabledReason}>
                  {button}
                </span>
              );
            }

            return <span className="inline-flex">{button}</span>;
          },
        },
      ];
    }

    if (variant === 'freeAgent') {
      return [
        {
          id: 'name',
          header: 'Name',
          accessorFn: (row) => formatName(row),
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
          accessorKey: 'age',
          header: 'Age',
          meta: { mobileHidden: true },
          accessorFn: (row) => row.age ?? null,
          cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
              {row.original.age !== undefined && row.original.age !== null
                ? Math.floor(row.original.age)
                : '—'}
            </span>
          ),
        },
        {
          id: 'marketValue',
          header: ({ column }) => (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Market Value
              <ArrowUpDown className="h-3 w-3" />
            </button>
          ),
          meta: { mobileHidden: false },
          accessorFn: (row) => row.marketValue ?? undefined,
          sortUndefined: 'last',
          cell: ({ row }) => (
            <span className="text-sm font-semibold text-foreground">
              {isSignedPlayer(row.original)
                ? (formatSignedMarketValue(row.original) ?? '—')
                : row.original.marketValue !== null && row.original.marketValue !== undefined
                  ? formatMarketValue(row.original.marketValue)
                  : '—'}
            </span>
          ),
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
    }

    return [
      {
        id: 'cutSort',
        accessorFn: (row) => (isCutPlayer(row) ? 1 : 0),
        enableSorting: true,
        meta: { hidden: true },
      },
      {
        id: 'name',
        header: 'Name',
        accessorFn: (row) => formatName(row),
        cell: ({ row }) => {
          const player = row.original;
          const isCut = isCutPlayer(player);
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
    () =>
      columns.filter((column) => !column.meta?.hidden && !(isMobile && column.meta?.mobileHidden)),
    [columns, isMobile],
  );

  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      setSorting((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (variant === 'roster') {
          const withoutCut = next.filter((item) => item.id !== 'cutSort');
          return [{ id: 'cutSort', desc: true }, ...withoutCut];
        }
        return next;
      });
    },
    [variant],
  );

  const table = useReactTable({
    data: filteredData,
    columns: visibleColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: handleSortingChange,
    getRowId: (row) => row.id,
  });

  const signedTable = useReactTable({
    data: signedData,
    columns: visibleColumns,
    getCoreRowModel: getCoreRowModel(),
    state: { sorting: [] },
    manualSorting: true,
    getRowId: (row) => row.id,
  });

  const availableTable = useReactTable({
    data: availableData,
    columns: visibleColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: handleSortingChange,
    getRowId: (row) => row.id,
  });

  const resetFilters = () => {
    setPositionFilter('All');
    setSearchQuery('');
  };

  const actionHeaderClass = isDraftVariant
    ? 'sticky right-0 z-30 w-[120px] min-w-[120px] bg-slate-50 text-right border-l border-slate-200'
    : 'w-[88px] text-right';
  const actionCellClass = isDraftVariant
    ? 'sticky right-0 z-20 w-[120px] min-w-[120px] bg-white text-right border-l border-slate-200'
    : 'w-[88px] text-right';
  const rankHeaderClass = isDraftVariant ? 'w-[64px] min-w-[64px]' : '';
  const tableClassName = isDraftVariant
    ? 'w-full border-collapse table-fixed'
    : 'w-full border-collapse md:min-w-[720px]';

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PositionFilterBar active={positionFilter} onSelect={setPositionFilter} />
          {variant !== 'draft' ? (
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
                  <DropdownMenuItem onClick={() => setSearchQuery('')}>
                    Clear search
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>
      <div className="max-w-full space-y-6 overflow-x-auto px-4 py-4 sm:px-6">
        {variant === 'freeAgent' && signedData.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Signed
            </p>
            <table className={tableClassName}>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                {signedTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className={cn(
                          'px-4 py-2 sm:px-6',
                          header.column.id === 'actions' && actionHeaderClass,
                          header.column.id === 'rank' && rankHeaderClass,
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
                {signedTable.getRowModel().rows.map((row) => {
                  const isCut = isCutPlayer(row.original);
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
                            cell.column.id === 'actions' && actionCellClass,
                            cell.column.id === 'rank' && rankHeaderClass,
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
        ) : null}

        <div className="space-y-3">
          {variant === 'freeAgent' ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Available
            </p>
          ) : null}
          <table className={tableClassName}>
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
              {(variant === 'freeAgent' ? availableTable : table)
                .getHeaderGroups()
                .map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className={cn(
                          'px-4 py-2 sm:px-6',
                          header.column.id === 'actions' && actionHeaderClass,
                          header.column.id === 'rank' && rankHeaderClass,
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
              {(variant === 'freeAgent' ? availableTable : table).getRowModel().rows.map((row) => {
                const isCut = isCutPlayer(row.original);
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
                          cell.column.id === 'actions' && actionCellClass,
                          cell.column.id === 'rank' && rankHeaderClass,
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
      </div>
      {filteredData.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
          No players match the current filters.
        </div>
      )}
    </div>
  );
}
