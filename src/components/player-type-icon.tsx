'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  getPlayerTypeIndicator,
  type PlayerTypeIndicatorInput,
  type PlayerTypeIndicatorResult,
} from '@/lib/player-type-indicator';

type PlayerTypeIconProps = {
  player?: PlayerTypeIndicatorInput | null;
  indicator?: PlayerTypeIndicatorResult | null;
  className?: string;
};

export default function PlayerTypeIcon({
  player,
  indicator: providedIndicator,
  className,
}: PlayerTypeIconProps) {
  const indicator = providedIndicator ?? getPlayerTypeIndicator(player);

  if (!indicator) {
    return null;
  }

  const Icon = indicator.icon;

  return (
    <span
      className={cn('inline-flex shrink-0 items-center align-middle', indicator.className, className)}
      title={indicator.label}
      aria-label={indicator.label}
      data-player-type={indicator.type}
    >
      <Icon className={cn('h-3.5 w-3.5', indicator.iconClassName)} />
    </span>
  );
}
