'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowLeftRight, ArrowUpDown, Loader2, MoreHorizontal } from 'lucide-react';

import PlayerRowActions, { type PlayerRowActionsVariant } from '@/components/player-row-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getPreferredYearsForPlayer } from '@/lib/contracts';
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

const POSITION_FILTER_LABELS: Record<(typeof POSITION_FILTERS)[number], string> = {
  All: 'All Positions',
  QB: 'Quarterback',
  RB: 'Running Back',
  WR: 'Wide Receiver',
  TE: 'Tight End',
  ED: 'Edge',
  OL: 'Offensive Line',
  DL: 'Defensive Line',
  LB: 'Linebacker',
  CB: 'Cornerback',
  S: 'Safety',
  K: 'Kicker',
  P: 'Punter',
};

export type PlayerTableVariant = PlayerRowActionsVariant;

type PlayerColumnDef = ColumnDef<PlayerRowDTO> & {
  meta?: {
    mobileHidden?: boolean;
    desktopHidden?: boolean;
    hidden?: boolean;
  };
};

const SortableHeader = ({
  column,
  label,
}: {
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | 'asc' | 'desc' };
  label: string;
}) => (
  <button
    type="button"
    className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase text-muted-foreground"
    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
  >
    {label}
    <ArrowUpDown className="h-3 w-3" />
  </button>
);

const getColumnId = (column: PlayerColumnDef): string | null => {
  if (typeof column.id === 'string' && column.id.length > 0) return column.id;
  if (
    'accessorKey' in column &&
    typeof column.accessorKey === 'string' &&
    column.accessorKey.length > 0
  ) {
    return column.accessorKey;
  }
  return null;
};

type PlayerTableProps = {
  data: PlayerRowDTO[];
  variant: PlayerTableVariant;
  loading?: boolean;
  freeAgentView?: 'available' | 'signed';
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
const formatSignedMarketValue = (player: PlayerRowDTO) => {
  const years = player.contract?.yearsRemaining ?? player.contractYearsRemaining;
  const apy = player.contract?.apy;
  if (!years || !apy) return null;
  const apyFormatted =
    Math.abs(apy - Math.round(apy)) < 0.05 ? Math.round(apy).toString() : apy.toFixed(1);
  return `${years} yr / $${apyFormatted}M`;
};

const formatContractAsk = (player: PlayerRowDTO) => {
  const expectedApy =
    player.expectedAnnualValue ??
    player.freeAgentProfile?.expectedAnnualValue ??
    (typeof player.marketValue === 'number' ? player.marketValue / 1_000_000 : null);
  if (expectedApy === null) return '—';

  const preferredYearsUpperBound = Math.min(5, getPreferredYearsForPlayer(player) + 1);
  const apyFormatted =
    Math.abs(expectedApy - Math.round(expectedApy)) < 0.05
      ? Math.round(expectedApy).toString()
      : expectedApy.toFixed(1);

  return `${preferredYearsUpperBound} yr / $${apyFormatted}M`;
};

const isSignedPlayer = (player: PlayerRowDTO) =>
  player.status.toLowerCase() === 'signed' ||
  player.availabilityStatus === 'signed' ||
  player.marketStatus === 'signed' ||
  player.freeAgentProfile?.availabilityStatus === 'signed' ||
  player.freeAgentProfile?.marketStatus === 'signed';
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
    <div className="w-full">
      <div className="md:hidden">
        <label className="sr-only" htmlFor="player-position-filter">
          Filter by position
        </label>
        <select
          id="player-position-filter"
          value={active}
          onChange={(event) => onSelect(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background pl-3 pr-10 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {POSITION_FILTERS.map((position) => (
            <option key={position} value={position}>
              {POSITION_FILTER_LABELS[position]}
            </option>
          ))}
        </select>
      </div>
      <div className="-mx-1 hidden overflow-x-auto pb-1 md:block">
        <div className="flex min-w-max gap-2 px-1">
          {POSITION_FILTERS.map((position) => (
            <Button
              key={position}
              type="button"
              variant={active === position ? 'secondary' : 'ghost'}
              size="sm"
              className="h-9 rounded-full px-3 text-xs"
              onClick={() => onSelect(position)}
            >
              {position}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlayerTable({
  data,
  variant,
  loading = false,
  freeAgentView = 'available',
  onTheClockForUserTeam = false,
  onCutPlayer,
  onTradePlayer,
  onOfferPlayer,
  onDraftPlayer,
  onResignPlayer,
  onRenegotiatePlayer,
  onSelectTradePlayer,
}: PlayerTableProps) {
  const [positionFilter, setPositionFilter] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const skeletonRows = React.useMemo(() => Array.from({ length: 8 }, (_, index) => index), []);
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
        { id: 'ratingSort', desc: true },
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
        { id: 'ratingSort', desc: true },
        { id: 'name', desc: false },
      ]);
      return;
    }
    setSorting([]);
  }, [variant]);

  const filteredData = React.useMemo(() => {
    if (loading) return [];
    return data.filter((player) => {
      const matchesPosition = matchesPositionFilter(player.position, positionFilter);
      const matchesSearch =
        searchQuery.trim().length === 0 ||
        formatName(player).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDraftFilter = variant !== 'draft' || !player.isDrafted;

      return matchesPosition && matchesSearch && matchesDraftFilter;
    });
  }, [data, loading, positionFilter, searchQuery, variant]);

  const signedData = React.useMemo(() => {
    if (loading || variant !== 'freeAgent') return [];
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
  }, [filteredData, loading, variant]);

  const availableData = React.useMemo(() => {
    if (loading || variant !== 'freeAgent') return [];
    return filteredData.filter((player) => !isSignedPlayer(player));
  }, [filteredData, loading, variant]);

  const columns = React.useMemo<PlayerColumnDef[]>(() => {
    if (variant === 'draft') {
      return [
        {
          accessorKey: 'rank',
          header: ({ column }) => <SortableHeader column={column} label="Rank" />,
          cell: ({ row }) => (
            <span className="text-sm font-semibold text-foreground">
              {row.original.rank ?? '-'}
            </span>
          ),
        },
        {
          accessorKey: 'name',
          header: ({ column }) => <SortableHeader column={column} label="Name" />,
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
                      loading="lazy"
                      decoding="async"
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
                    {player.position}
                    {player.age !== undefined && player.age !== null
                      ? ` · Age ${Math.floor(player.age)}`
                      : ''}
                    {player.college ? ` · ${player.college}` : ''}
                  </p>
                </div>
              </div>
            );
          },
        },
        {
          id: 'actions',
          header: 'ACTIONS',
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
          id: 'ratingSort',
          accessorFn: (row) => row.rating ?? -1,
          enableSorting: true,
          meta: { hidden: true },
        },
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
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    getInitials(player)
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{formatName(player)}</p>
                  <p className="text-xs text-muted-foreground md:hidden">
                    {player.position}
                    {player.rating !== undefined && player.rating !== null
                      ? ` · OVR ${player.rating}`
                      : ''}
                    {' · '}
                    {isSignedPlayer(player)
                      ? (formatSignedMarketValue(player) ?? 'Signed')
                      : formatContractAsk(player)}
                  </p>
                </div>
              </div>
            );
          },
        },
        {
          accessorKey: 'position',
          header: ({ column }) => <SortableHeader column={column} label="Pos" />,
          cell: ({ row }) => (
            <span className="text-sm font-medium text-foreground">{row.original.position}</span>
          ),
        },
        {
          accessorKey: 'age',
          header: ({ column }) => <SortableHeader column={column} label="Age" />,
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
          id: 'contractAsk',
          header: ({ column }) => <SortableHeader column={column} label="Ask" />,
          accessorFn: (row) => row.expectedAnnualValue ?? row.marketValue ?? 0,
          cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
              {isSignedPlayer(row.original)
                ? (formatSignedMarketValue(row.original) ?? '—')
                : formatContractAsk(row.original)}
            </span>
          ),
        },
        {
          id: 'demandTier',
          header: ({ column }) => <SortableHeader column={column} label="Tier" />,
          accessorFn: (row) => row.marketTier ?? row.freeAgentProfile?.marketTier ?? '',
          cell: ({ row }) => (
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
              {row.original.marketTier ?? row.original.freeAgentProfile?.marketTier ?? '—'}
            </span>
          ),
        },
        {
          accessorKey: 'status',
          header: ({ column }) => <SortableHeader column={column} label="Status" />,
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
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
            );
          },
        },
        {
          id: 'actions',
          header: 'ACTIONS',
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
        header: ({ column }) => <SortableHeader column={column} label="Name" />,
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
                    loading="lazy"
                    decoding="async"
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
                <p className="text-xs text-muted-foreground md:hidden">
                  {player.position}
                  {player.contractYearsRemaining > 0
                    ? ` · ${player.contractYearsRemaining} yr`
                    : ''}
                  {' · '}
                  {formatMillions(parseCapHitValue(player))}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'position',
        header: ({ column }) => <SortableHeader column={column} label="Pos" />,
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground">{row.original.position}</span>
        ),
      },
      {
        accessorKey: 'age',
        header: ({ column }) => <SortableHeader column={column} label="Age" />,
        meta: { desktopHidden: true },
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
        accessorKey: 'contractYearsRemaining',
        header: ({ column }) => <SortableHeader column={column} label="Contract" />,
        meta: { mobileHidden: true },
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.contractYearsRemaining > 0
              ? `${row.original.contractYearsRemaining} yrs`
              : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'capHitValue',
        id: 'capHitValue',
        header: ({ column }) => <SortableHeader column={column} label="Cap Hit" />,
        meta: { mobileHidden: false },
        accessorFn: (row) => parseCapHitValue(row),
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-foreground">
            {formatMillions(parseCapHitValue(row.original))}
          </span>
        ),
      },
      {
        id: 'capSavings',
        header: ({ column }) => <SortableHeader column={column} label="Cap Savings" />,
        meta: { mobileHidden: false },
        accessorFn: (row) => {
          const capHitValue = parseCapHitValue(row);
          const deadCap = row.deadCap ?? 0;
          return row.releaseSavings ?? Math.max(0, capHitValue - deadCap);
        },
        cell: ({ row }) => {
          const capHitValue = parseCapHitValue(row.original);
          const deadCap = row.original.deadCap ?? 0;
          const savings = row.original.releaseSavings ?? Math.max(0, capHitValue - deadCap);
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
        id: 'actions',
        header: 'ACTIONS',
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

  const columnVisibility = React.useMemo<VisibilityState>(() => {
    const visibility: VisibilityState = {};

    columns.forEach((column) => {
      const columnId = getColumnId(column);
      if (!columnId) return;
      if (column.meta?.hidden) {
        visibility[columnId] = false;
        return;
      }
      if (column.meta?.desktopHidden) {
        visibility[columnId] = false;
      }
    });

    return visibility;
  }, [columns]);

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
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnVisibility },
    onSortingChange: handleSortingChange,
    getRowId: (row) => row.id,
  });

  const freeAgentTableData = React.useMemo(() => {
    if (variant !== 'freeAgent') {
      return filteredData;
    }
    return freeAgentView === 'signed' ? signedData : availableData;
  }, [availableData, filteredData, freeAgentView, signedData, variant]);

  const freeAgentTable = useReactTable({
    data: freeAgentTableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnVisibility },
    onSortingChange: handleSortingChange,
    getRowId: (row) => row.id,
  });

  const resetFilters = () => {
    setPositionFilter('All');
    setSearchQuery('');
  };

  const actionHeaderClass = isDraftVariant
    ? 'sticky right-0 z-30 box-border w-[120px] min-w-[120px] border-l border-slate-200 bg-slate-50 text-left'
    : 'sticky right-0 z-20 box-border w-[144px] min-w-[144px] border-l border-slate-200 bg-slate-50 pl-4 pr-2 text-left shadow-[-8px_0_14px_-14px_rgba(15,23,42,0.18)] md:static md:w-[88px] md:min-w-0 md:border-l-0 md:bg-transparent md:px-6 md:text-left md:shadow-none';
  const actionCellClass = isDraftVariant
    ? 'sticky right-0 z-20 box-border w-[120px] min-w-[120px] border-l border-slate-200 bg-white text-left'
    : 'sticky right-0 z-10 box-border w-[144px] min-w-[144px] border-l border-slate-200 bg-white pl-4 pr-2 text-left shadow-[-8px_0_14px_-14px_rgba(15,23,42,0.14)] md:static md:w-[88px] md:min-w-0 md:border-l-0 md:bg-transparent md:px-6 md:text-right md:shadow-none';
  const rankHeaderClass = isDraftVariant ? 'w-[64px] min-w-[64px]' : '';
  const tableClassName = isDraftVariant
    ? 'w-full border-collapse table-fixed'
    : 'min-w-full w-max border-collapse table-fixed md:min-w-[720px] md:w-full md:table-auto';
  const getResponsiveColumnClass = (columnId: string) => {
    if (columnId === 'name') {
      return 'w-[180px] min-w-[180px] md:w-auto md:min-w-0';
    }
    if (columnId === 'position') {
      return 'w-[64px] min-w-[64px] md:w-auto md:min-w-0';
    }
    if (columnId === 'age') {
      return 'w-[64px] min-w-[64px] md:w-auto md:min-w-0';
    }
    if (columnId === 'actions') {
      return actionHeaderClass;
    }
    if (columnId === 'rank') {
      return rankHeaderClass;
    }
    return 'w-[112px] min-w-[112px] md:w-auto md:min-w-0';
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PositionFilterBar active={positionFilter} onSelect={setPositionFilter} />
          {variant !== 'draft' ? (
            <div className="flex w-full items-center gap-2 sm:w-auto sm:max-w-sm">
              <input
                type="search"
                placeholder="Search players..."
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-9"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 sm:h-9 sm:w-9"
                  >
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
      <div className="py-3 sm:px-6 sm:py-4">
        <div className="px-4 md:hidden">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Swipe to see more columns.</span>
          </div>
        </div>
        <div className="mt-3 w-full overflow-x-auto overscroll-x-contain">
          <table className={tableClassName}>
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
              {(variant === 'freeAgent' ? freeAgentTable : table)
                .getHeaderGroups()
                .map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className={cn(
                          'px-4 py-2 text-left sm:px-6',
                          getResponsiveColumnClass(header.column.id),
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
              {loading
                ? skeletonRows.map((rowIndex) => (
                    <tr key={`skeleton-${rowIndex}`} className="border-t border-border">
                      {(variant === 'freeAgent' ? freeAgentTable : table)
                        .getVisibleLeafColumns()
                        .map((column) => (
                          <td
                            key={`${column.id}-${rowIndex}`}
                            className={cn(
                              'px-3 py-3 align-middle sm:px-6',
                              column.id === 'actions'
                                ? actionCellClass
                                : getResponsiveColumnClass(column.id),
                            )}
                          >
                            <div
                              className={cn(
                                'h-4 animate-pulse rounded bg-slate-200/80',
                                column.id === 'name'
                                  ? 'w-40'
                                  : column.id === 'actions'
                                    ? 'w-full'
                                    : 'w-12',
                              )}
                            />
                          </td>
                        ))}
                    </tr>
                  ))
                : (variant === 'freeAgent' ? freeAgentTable : table)
                    .getRowModel()
                    .rows.map((row) => {
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
                                'px-3 py-2.5 align-middle text-sm sm:px-6 sm:py-1.5',
                                cell.column.id === 'actions'
                                  ? actionCellClass
                                  : getResponsiveColumnClass(cell.column.id),
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
        {loading ? (
          <div className="mt-3 flex items-center gap-2 px-4 text-xs text-muted-foreground sm:px-0">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Loading players...</span>
          </div>
        ) : null}
      </div>
      {!loading &&
        (variant === 'freeAgent' ? freeAgentTableData.length === 0 : filteredData.length === 0) && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
            No players match the current filters.
          </div>
        )}
    </div>
  );
}
