import { useCallback, useEffect, useState } from 'react';

import { useSaveStore } from '@/features/save/save-store';
import type { PlayerRowDTO } from '@/types/player';
import { apiFetch } from '@/lib/api';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';

type PlayerQueryResult = {
  data: PlayerRowDTO[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const playerListCache = new Map<string, PlayerRowDTO[]>();

const isDev = process.env.NODE_ENV !== 'production';

const getCacheKey = (endpoint: string, saveId?: string | null, teamAbbr?: string | null) =>
  `${endpoint}:${saveId ?? 'none'}:${teamAbbr ?? 'none'}`;

const logTiming = (label: string, durationMs: number, extra?: Record<string, unknown>) => {
  if (!isDev) return;
  const rounded = Number(durationMs.toFixed(1));
  console.info(`[player-list] ${label} ${rounded}ms`, extra ?? {});
};

const usePlayerQuery = (
  saveId: string | null | undefined,
  teamAbbr: string | null | undefined,
  endpoint: string,
  errorMessage: string,
): PlayerQueryResult => {
  const cacheKey = getCacheKey(endpoint, saveId, teamAbbr);
  const [data, setData] = useState<PlayerRowDTO[]>(() => playerListCache.get(cacheKey) ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!saveId) {
      setData([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = playerListCache.get(cacheKey);
    if (cached && cached.length > 0) {
      setData(cached);
    }
    setIsLoading(true);
    setError(null);

    try {
      const fetchRows = async (activeSaveId: string) => {
        const saveState = useSaveStore.getState();
        const params = new URLSearchParams({ saveId: activeSaveId });
        const activeTeamAbbr = teamAbbr ?? saveState.teamAbbr;
        if (activeTeamAbbr) {
          params.set('teamAbbr', activeTeamAbbr);
        }
        const url = `${endpoint}?${params.toString()}`;
        const fetchStartedAt = performance.now();
        let response = await apiFetch(url, undefined, { skipSaveGuard: true });
        let fetchEndedAt = performance.now();
        if (response.status === 404) {
          const recoveredSaveId = await ensureRecoverableSaveId(
            {
              preferredSaveId: activeSaveId,
              teamId: saveState.teamId,
              teamAbbr: activeTeamAbbr,
              capSpace: saveState.capSpace,
              capLimit: saveState.capLimit,
              roster: saveState.roster,
              phase: saveState.phase,
              unlocked: saveState.unlocked,
            },
            saveState.setSaveHeader,
          );
          if (recoveredSaveId) {
            const retryParams = new URLSearchParams({ saveId: recoveredSaveId });
            if (activeTeamAbbr) {
              retryParams.set('teamAbbr', activeTeamAbbr);
            }
            response = await apiFetch(`${endpoint}?${retryParams.toString()}`, undefined, {
              skipSaveGuard: true,
            });
            fetchEndedAt = performance.now();
          }
        }

        return { response, fetchStartedAt, fetchEndedAt };
      };

      const { response, fetchStartedAt, fetchEndedAt } = await fetchRows(saveId);
      if (!response.ok) {
        setError(errorMessage);
        return;
      }

      const jsonStartedAt = performance.now();
      const payload = (await response.json()) as PlayerRowDTO[];
      const jsonEndedAt = performance.now();
      playerListCache.set(cacheKey, payload);
      setData(payload);
      logTiming('fetch', fetchEndedAt - fetchStartedAt, {
        endpoint,
        count: payload.length,
      });
      logTiming('json', jsonEndedAt - jsonStartedAt, {
        endpoint,
        count: payload.length,
      });
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    cacheKey,
    endpoint,
    errorMessage,
    saveId,
    teamAbbr,
  ]);

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
