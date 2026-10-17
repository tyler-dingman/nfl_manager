import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { readMarketNavigation, type MarketFacet } from '../../../packages/parlay/market-navigation';
/** Expo keeps discovery state in the current route without pushing another native screen. */
export function usePropMarketNavigation(view: string, facets?: MarketFacet[]) {
  const params = useLocalSearchParams<{ category?: string; market?: string }>();
  const enabled = view === 'all-props' || view === 'trends';
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.market) query.set('market', params.market);
  const selection = readMarketNavigation(query, facets);
  const { category, market } = selection;
  useEffect(() => {
    if (!enabled) return;
    const nextCategory = category === 'ALL' ? undefined : category.toLowerCase();
    const nextMarket = market === 'ALL' ? undefined : market.toLowerCase();
    if (params.category !== nextCategory || params.market !== nextMarket)
      router.setParams({ category: nextCategory, market: nextMarket });
  }, [enabled, category, market, params.category, params.market]);
  const navigate = (category: string, market = 'ALL') =>
    router.setParams({
      view,
      category: category === 'ALL' ? undefined : category.toLowerCase(),
      market: market === 'ALL' ? undefined : market.toLowerCase(),
    });
  return {
    ...selection,
    onCategory: (category: string) => navigate(category),
    onMarket: (market: string) => navigate(category, market),
  };
}
