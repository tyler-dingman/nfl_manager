import type { CatalogProgress } from '../../../packages/parlay/prop-catalog';
import { createResearchRequestCache } from '../../../packages/parlay/research-request-cache';
import type { HomeMarket } from '../../../packages/parlay/research';
export const getDiscoveryResearch = createResearchRequestCache(
  async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Markets could not be loaded. Please try again.');
    return response.json() as Promise<{ markets: HomeMarket[]; progress?: CatalogProgress }>;
  },
  Date.now,
  (body) => (body.progress?.complete === false ? 0 : 60_000),
);
