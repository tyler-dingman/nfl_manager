import type { ExpiringContractRow } from '@/lib/expiring-contracts';

type ExpiringContractsResponse =
  | { ok: true; players: ExpiringContractRow[] }
  | { ok: false; error: string };

export const fetchExpiringContracts = async (
  saveId?: string | null,
): Promise<ExpiringContractRow[]> => {
  const query = saveId ? `?saveId=${saveId}` : '';
  const response = await fetch(`/api/contracts/expiring${query}`);
  if (!response.ok) {
    throw new Error('Unable to load expiring contracts.');
  }

  const payload = (await response.json()) as ExpiringContractsResponse;
  if (!payload.ok) {
    throw new Error(payload.error || 'Unable to load expiring contracts.');
  }

  return payload.players;
};
