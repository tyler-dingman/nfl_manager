import { apiFetch } from '@/lib/api';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveBootstrapDTO, SaveUnlocksDTO } from '@/types/save';

type RecoverSaveOptions = {
  preferredSaveId?: string | null;
  teamId?: string | null;
  teamAbbr?: string | null;
  year?: number | null;
  capSpace: number;
  capLimit: number;
  roster: PlayerRowDTO[];
  phase: string;
  unlocked: SaveUnlocksDTO;
  createdAt?: string | null;
};

type SetSaveHeader = (header: SaveBootstrapDTO, teamId?: string) => void;

const isBootstrapResponse = (
  value: unknown,
): value is SaveBootstrapDTO =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'ok' in value &&
      (value as { ok?: boolean }).ok === true &&
      'saveId' in value,
  );

export const ensureRecoverableSaveId = async (
  options: RecoverSaveOptions,
  setSaveHeader: SetSaveHeader,
): Promise<string | null> => {
  let nextSaveId = options.preferredSaveId ?? null;
  const hasClientRoster = options.roster.length > 0;

  if (nextSaveId) {
    const headerParams = new URLSearchParams({ saveId: nextSaveId });
    if (options.teamAbbr) {
      headerParams.set('teamAbbr', options.teamAbbr);
    }
    const headerResponse = await apiFetch(
      `/api/saves/header?${headerParams.toString()}`,
      undefined,
      { skipSaveGuard: true },
    );

    if (headerResponse.ok) {
      return nextSaveId;
    }

    if (headerResponse.status !== 404) {
      return null;
    }

    if (hasClientRoster) {
      const restoreResponse = await apiFetch(
        '/api/saves/restore',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saveId: nextSaveId,
            teamAbbr: options.teamAbbr,
            year: options.year ?? undefined,
            capSpace: options.capSpace,
            capLimit: options.capLimit,
            roster: options.roster,
            phase: options.phase,
            unlocked: options.unlocked,
            createdAt: options.createdAt ?? undefined,
          }),
        },
        { skipSaveGuard: true },
      );

      if (restoreResponse.ok) {
        const restoreData = (await restoreResponse.json()) as SaveBootstrapDTO | { ok: false };
        if (isBootstrapResponse(restoreData)) {
          setSaveHeader(restoreData, options.teamId ?? undefined);
          return restoreData.saveId;
        }
      }
    }

    nextSaveId = null;
  }

  const createResponse = await apiFetch('/api/saves/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: options.teamId || undefined,
      teamAbbr: options.teamAbbr || undefined,
      year: options.year ?? undefined,
    }),
  });
  if (!createResponse.ok) {
    return null;
  }

  const createData = (await createResponse.json()) as SaveBootstrapDTO | { ok: false };
  if (!isBootstrapResponse(createData)) {
    return null;
  }

  if (!hasClientRoster) {
    setSaveHeader(createData, options.teamId ?? undefined);
    return createData.saveId;
  }

  const restoredSaveId = createData.saveId;
  const restoreResponse = await apiFetch(
    '/api/saves/restore',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveId: restoredSaveId,
        teamAbbr: options.teamAbbr ?? createData.teamAbbr,
        year: options.year ?? createData.year,
        capSpace: options.capSpace,
        capLimit: options.capLimit,
        roster: options.roster,
        phase: options.phase,
        unlocked: options.unlocked,
        createdAt: options.createdAt ?? createData.createdAt,
      }),
    },
    { skipSaveGuard: true },
  );

  if (!restoreResponse.ok) {
    return null;
  }

  const restoreData = (await restoreResponse.json()) as SaveBootstrapDTO | { ok: false };
  if (!isBootstrapResponse(restoreData)) {
    return null;
  }

  setSaveHeader(restoreData, options.teamId ?? undefined);
  return restoreData.saveId;
};
