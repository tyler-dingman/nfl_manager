'use client';
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  readMarketNavigation,
  writeMarketNavigation,
  type MarketFacet,
} from '../../../packages/parlay/market-navigation';
/** Route state is authoritative. No mirrored category state or storage hydration race. */
export function usePropMarketNavigation(enabled: boolean, facets?: MarketFacet[]) {
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const query = params?.toString() ?? '';
  const selection = readMarketNavigation(new URLSearchParams(query), facets);
  const { category, market } = selection;
  const href = (next: URLSearchParams) => `${pathname}${next.size ? `?${next}` : ''}`;
  useEffect(() => {
    if (!enabled) return;
    const next = writeMarketNavigation(new URLSearchParams(query), category, market);
    if (next.toString() !== query)
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }, [enabled, category, market, query, pathname, router]);
  const navigate = (category: string, market = 'ALL') => {
    const next = writeMarketNavigation(new URLSearchParams(query), category, market);
    if (next.toString() !== query) router.push(href(next), { scroll: false });
  };
  return {
    ...selection,
    onCategory: (category: string) => navigate(category),
    onMarket: (market: string) => navigate(category, market),
  };
}
