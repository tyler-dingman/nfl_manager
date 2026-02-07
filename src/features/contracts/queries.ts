import type { ExpiringContractRow } from '@/lib/expiring-contracts';
import { apiFetch } from '@/lib/api';

type ExpiringContractsResponse =
  | { ok: true; players: ExpiringContractRow[] }
  | { ok: false; error: string };

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
