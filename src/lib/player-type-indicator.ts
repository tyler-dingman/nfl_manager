import { createElement, type ComponentType, type SVGProps } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
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
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  className: string;
  iconClassName?: string;
};

const SuperstarStarIcon = (props: SVGProps<SVGSVGElement>) =>
  createElement(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true', ...props },
    createElement('path', {
      d: 'M12 3.2L14.25 8.55',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.95',
    }),
    createElement('path', {
      d: 'M14.25 8.55H20.15L15.6 11.95',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.7',
    }),
    createElement('path', {
      d: 'M15.6 11.95L17.35 18.9L12 15.65L6.65 18.9L8.4 11.95',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.65',
    }),
    createElement('path', {
      d: 'M8.4 11.95L3.85 8.55H9.75L12 3.2',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.9',
    }),
  );

const SUPERSTAR_INDICATOR: PlayerTypeIndicatorResult = {
  type: 'superstar',
  label: 'Superstar',
  icon: SuperstarStarIcon,
  className: 'text-amber-500',
  iconClassName: '',
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
