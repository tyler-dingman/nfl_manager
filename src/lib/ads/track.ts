import type { AdPlacement } from '@/lib/ads/adConfig';

export const trackAdImpression = (placement: AdPlacement, creativeId: string, route: string) => {
  if (process.env.NODE_ENV === 'production') return;
  // eslint-disable-next-line no-console
  console.info('[ads] impression', { placement, creativeId, route });
};

export const trackAdClick = (placement: AdPlacement, creativeId: string, route: string) => {
  if (process.env.NODE_ENV === 'production') return;
  // eslint-disable-next-line no-console
  console.info('[ads] click', { placement, creativeId, route });
};
