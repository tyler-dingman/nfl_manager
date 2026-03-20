'use client';

import { Flame, ShieldCheck, Sparkles, Star, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { ProspectIndicator } from '@/lib/draft-prospect-details';
import { cn } from '@/lib/utils';

const indicatorIcon = (label: string) => {
  if (label === 'Best Available') return Star;
  if (label === 'Team Fit') return ShieldCheck;
  if (label === 'Steal' || label === 'Sleeper') return Sparkles;
  if (label === 'Run Risk') return Flame;
  return TrendingUp;
};

const badgeClass = (tone: ProspectIndicator['tone']) => {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (tone === 'danger') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (tone === 'accent') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

type ProspectIndicatorsProps = {
  indicators: ProspectIndicator[];
  compact?: boolean;
  className?: string;
};

export function ProspectIndicators({
  indicators,
  compact = false,
  className,
}: ProspectIndicatorsProps) {
  if (indicators.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {indicators.map((indicator) => {
        const Icon = indicatorIcon(indicator.label);
        return (
          <Badge
            key={indicator.key}
            variant="outline"
            className={cn(
              'gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
              badgeClass(indicator.tone),
              compact ? 'px-2 py-0.5 text-[10px]' : '',
            )}
            title={indicator.label}
          >
            <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            {indicator.label}
          </Badge>
        );
      })}
    </div>
  );
}
