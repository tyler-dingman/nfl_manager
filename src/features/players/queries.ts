import { useCallback, useEffect, useState } from 'react';

import type { PlayerRowDTO } from '@/types/player';
import { apiFetch } from '@/lib/api';

type PlayerQueryResult = {
  data: PlayerRowDTO[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const usePlayerQuery = (
  saveId: string | null | undefined,
  teamAbbr: string | null | undefined,
  endpoint: string,
  errorMessage: string,
): PlayerQueryResult => {
  const [data, setData] = useState<PlayerRowDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!saveId) {
      setData([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ saveId });
      if (teamAbbr) {
        params.set('teamAbbr', teamAbbr);
      }
      const response = await apiFetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) {
        setError(errorMessage);
        return;
      }

      const payload = (await response.json()) as PlayerRowDTO[];
      setData(payload);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, errorMessage, saveId, teamAbbr]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
};

export const useRosterQuery = (
  saveId: string | null | undefined,
  teamAbbr?: string | null,
): PlayerQueryResult => usePlayerQuery(saveId, teamAbbr, '/api/roster', 'Unable to load roster.');

export const useFreeAgentsQuery = (
  saveId: string | null | undefined,
  teamAbbr?: string | null,
): PlayerQueryResult =>
  usePlayerQuery(saveId, teamAbbr, '/api/free-agents', 'Unable to load free agents.');
