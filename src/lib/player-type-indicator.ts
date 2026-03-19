import { Star, TrendingDown, TrendingUp } from 'lucide-react';
import type { PlayerRowDTO } from '@/types/player';

export type PlayerTypeIndicatorType = 'superstar' | 'upcoming' | 'declining';

export type PlayerTypeIndicatorInput = Pick<
  PlayerRowDTO,
  'age' | 'rating' | 'maddenRating' | 'baselineRating'
> & {
  resolvedRating?: number | null;
};

export type PlayerTypeIndicatorResult = {
  type: PlayerTypeIndicatorType;
  label: 'Superstar' | 'Up and Coming' | 'Declining';
  icon: typeof Star | typeof TrendingUp | typeof TrendingDown;
  className: string;
  iconClassName?: string;
};

const SUPERSTAR_INDICATOR: PlayerTypeIndicatorResult = {
  type: 'superstar',
  label: 'Superstar',
  icon: Star,
  className: 'text-amber-500',
  iconClassName: 'fill-current stroke-[1.75]',
};

const UPCOMING_INDICATOR: PlayerTypeIndicatorResult = {
  type: 'upcoming',
  label: 'Up and Coming',
  icon: TrendingUp,
  className: 'text-emerald-600',
};

const DECLINING_INDICATOR: PlayerTypeIndicatorResult = {
  type: 'declining',
  label: 'Declining',
  icon: TrendingDown,
  className: 'text-rose-500',
};

const resolveIndicatorRating = (player: PlayerTypeIndicatorInput) => {
  if (player.resolvedRating !== undefined) {
    return player.resolvedRating;
  }
  return player.rating ?? player.maddenRating ?? player.baselineRating ?? null;
};

export const getPlayerTypeIndicator = (
  player: PlayerTypeIndicatorInput | null | undefined,
): PlayerTypeIndicatorResult | null => {
  if (!player) {
    return null;
  }

  const rating = resolveIndicatorRating(player);
  if (rating === null || rating === undefined) {
    return null;
  }

  if (rating >= 90) {
    return SUPERSTAR_INDICATOR;
  }

  if (player.age === null || player.age === undefined) {
    return null;
  }

  if (player.age <= 26 && rating >= 82) {
    return UPCOMING_INDICATOR;
  }

  if (player.age >= 32 && rating <= 90) {
    return DECLINING_INDICATOR;
  }

  return null;
};
