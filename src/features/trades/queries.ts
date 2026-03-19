import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type { TradeBlockRow } from '@/types/trade-block';

type TradeBlockQueryResult = {
  data: TradeBlockRow[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const tradeBlockCache = new Map<string, TradeBlockRow[]>();

export const useTradeBlockQuery = (
  saveId: string | null | undefined,
  teamAbbr: string | null | undefined,
): TradeBlockQueryResult => {
  const cacheKey = `trade-block:${saveId ?? 'none'}:${teamAbbr ?? 'none'}`;
  const [data, setData] = useState<TradeBlockRow[]>(() => tradeBlockCache.get(cacheKey) ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!saveId) {
      setData([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = tradeBlockCache.get(cacheKey);
    if (cached && cached.length > 0) {
      setData(cached);
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ saveId });
      if (teamAbbr) {
        params.set('teamAbbr', teamAbbr);
      }

      const response = await apiFetch(`/api/trade-block?${params.toString()}`);
      if (!response.ok) {
        setError('Unable to load trade block.');
        return;
      }

      const payload = (await response.json()) as TradeBlockRow[];
      tradeBlockCache.set(cacheKey, payload);
      setData(payload);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'Unable to load trade block.');
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, saveId, teamAbbr]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
};
