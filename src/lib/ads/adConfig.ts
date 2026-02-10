export type AdPlacement = 'HEADER' | 'RIGHT_RAIL' | 'ANCHOR' | 'TRANSITION';

export type AdCreative = {
  id: string;
  src: string;
  href?: string;
  alt: string;
};

export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED !== 'false';

const HOUSE_CREATIVES: Record<AdPlacement, AdCreative[]> = {
  HEADER: [{ id: 'house-header-1', src: '/ads/house-header-1.svg', alt: 'House ad' }],
  RIGHT_RAIL: [
    { id: 'house-rail-1', src: '/ads/house-rail-1.svg', alt: 'House ad' },
    { id: 'house-rail-2', src: '/ads/house-rail-2.svg', alt: 'House ad' },
  ],
  ANCHOR: [{ id: 'house-anchor-1', src: '/ads/house-anchor-1.svg', alt: 'House ad' }],
  TRANSITION: [{ id: 'house-transition-1', src: '/ads/house-transition-1.svg', alt: 'House ad' }],
};

const hash = (value: string) => {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
};

export const getCreativeForPlacement = (placement: AdPlacement, route: string) => {
  const list = HOUSE_CREATIVES[placement] ?? [];
  if (!list.length) return null;
  const dayKey = new Date().toISOString().slice(0, 10);
  const index = hash(`${placement}:${route}:${dayKey}`) % list.length;
  return list[index] ?? list[0];
};

export const AD_PLACEMENT_ROUTES: Record<AdPlacement, string[]> = {
  HEADER: ['/experience'],
  RIGHT_RAIL: ['/experience', '/draft/room'],
  ANCHOR: ['/experience', '/draft/room'],
  TRANSITION: ['/draft/room'],
};
