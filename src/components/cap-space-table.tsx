import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import type { TeamInfo } from '@/data/teams';
import { cn } from '@/lib/utils';

export type CapSpaceRow = {
  teamName: string;
  teamAbbr: string;
  capSpace: number;
  effectiveCapSpace: number;
  activeCapSpending: number;
  deadMoney: number;
  activeCount: number;
};

const formatCurrency = (value: number) => {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return value < 0 ? `($${formatted})` : `$${formatted}`;
};

const initialsFromName = (name: string) =>
  name.split(' ').slice(-1)[0]?.slice(0, 2).toUpperCase() ?? '--';

export function CapSpaceTable({
  rows,
  teamsByAbbr,
}: {
  rows: CapSpaceRow[];
  teamsByAbbr: Record<string, TeamInfo | undefined>;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[2fr_repeat(4,1fr)_80px] items-center gap-3 rounded-xl bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <span>Team</span>
        <span>Cap Space</span>
        <span>Effective Cap</span>
        <span>Active Cap</span>
        <span>Dead Money</span>
        <span className="text-right"># Active</span>
      </div>
      {rows.map((row) => {
        const team = teamsByAbbr[row.teamAbbr];
        const isOverCap = row.effectiveCapSpace < 0;
        return (
          <div
            key={row.teamAbbr}
            className="grid grid-cols-[2fr_repeat(4,1fr)_80px] items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-slate-100 text-xs font-semibold text-slate-600">
                {team?.logoUrl ? (
                  <Image
                    src={team.logoUrl}
                    alt={`${row.teamName} logo`}
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  initialsFromName(row.teamName)
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{row.teamName}</p>
                <p className="text-xs text-muted-foreground">{row.teamAbbr}</p>
              </div>
              {isOverCap ? (
                <Badge variant="destructive" className="ml-2">
                  OVER CAP
                </Badge>
              ) : null}
            </div>
            <span className={cn('text-sm font-medium', isOverCap && 'text-red-600 font-semibold')}>
              {formatCurrency(row.capSpace)}
            </span>
            <span className={cn('text-sm font-medium', isOverCap && 'text-red-600 font-semibold')}>
              {formatCurrency(row.effectiveCapSpace)}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatCurrency(row.activeCapSpending)}
            </span>
            <span className="text-sm text-muted-foreground">{formatCurrency(row.deadMoney)}</span>
            <span className="text-right text-sm font-semibold text-foreground">
              {row.activeCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}
