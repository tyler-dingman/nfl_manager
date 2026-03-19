import { useCallback, useEffect, useState } from 'react';

import { useSaveStore } from '@/features/save/save-store';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import { apiFetch } from '@/lib/api';
import { ensureRecoverableSaveId } from '@/lib/save-recovery';

type ExpiringContractsResponse =
  | { ok: true; players: ExpiringContractRow[] }
  | { ok: false; error: string };

type ExpiringContractsQueryResult = {
  data: ExpiringContractRow[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const expiringContractsCache = new Map<string, ExpiringContractRow[]>();
const isDev = process.env.NODE_ENV !== 'production';

const getCacheKey = (saveId?: string | null, teamAbbr?: string | null) =>
  `${saveId ?? 'none'}:${teamAbbr ?? 'none'}`;

const logTiming = (label: string, durationMs: number, extra?: Record<string, unknown>) => {
  if (!isDev) return;
  console.info(`[expiring-list] ${label} ${Number(durationMs.toFixed(1))}ms`, extra ?? {});
};

export const fetchExpiringContracts = async (
  saveId?: string | null,
  teamAbbr?: string | null,
): Promise<ExpiringContractRow[]> => {
  const params = new URLSearchParams();
  if (saveId) {
    params.set('saveId', saveId);
  }
  if (teamAbbr) {
    params.set('teamAbbr', teamAbbr);
  }
  const query = params.toString();
  const response = await apiFetch(`/api/contracts/expiring${query ? `?${query}` : ''}`);
  if (!response.ok) {
    throw new Error('Unable to load expiring contracts.');
  }

  const payload = (await response.json()) as ExpiringContractsResponse;
  if (!payload.ok) {
    throw new Error(payload.error || 'Unable to load expiring contracts.');
  }

  return payload.players;
};

export const useExpiringContractsQuery = (
  saveId?: string | null,
  teamAbbr?: string | null,
): ExpiringContractsQueryResult => {
  const cacheKey = getCacheKey(saveId, teamAbbr);
  const [data, setData] = useState<ExpiringContractRow[]>(
    () => expiringContractsCache.get(cacheKey) ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const activeTeamAbbr = teamAbbr ?? useSaveStore.getState().teamAbbr;
    if (!activeTeamAbbr) {
      setData([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const cached = expiringContractsCache.get(cacheKey);
    if (cached && cached.length > 0) {
      setData(cached);
    }
    setIsLoading(true);
    setError(null);

    try {
      const fetchRows = async (activeSaveId?: string | null) => {
        const saveState = useSaveStore.getState();
        const params = new URLSearchParams();
        if (activeSaveId) {
          params.set('saveId', activeSaveId);
        }
        if (activeTeamAbbr) {
          params.set('teamAbbr', activeTeamAbbr);
        }
        const query = params.toString();
        const startedAt = performance.now();
        let response = await apiFetch(`/api/contracts/expiring${query ? `?${query}` : ''}`, undefined, {
          skipSaveGuard: true,
        });
        if (response.status === 404 && activeSaveId) {
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
            retryParams.set('teamAbbr', activeTeamAbbr);
            response = await apiFetch(`/api/contracts/expiring?${retryParams.toString()}`, undefined, {
              skipSaveGuard: true,
            });
          }
        }
        const endedAt = performance.now();
        if (!response.ok) {
          throw new Error('Unable to load expiring contracts.');
        }
        const payload = (await response.json()) as ExpiringContractsResponse;
        if (!payload.ok) {
          throw new Error(payload.error || 'Unable to load expiring contracts.');
        }
        return { rows: payload.players, startedAt, endedAt };
      };

      const { rows, startedAt, endedAt } = await fetchRows(saveId);
      expiringContractsCache.set(cacheKey, rows);
      setData(rows);
      logTiming('fetch+json', endedAt - startedAt, { count: rows.length });
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'Unable to load contracts.');
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, saveId, teamAbbr]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
};
