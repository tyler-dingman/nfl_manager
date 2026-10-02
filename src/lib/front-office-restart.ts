import type { SaveBootstrapDTO } from '@/types/save';
import type { FranchiseSimulationState } from '@/types/front-office';

/** Create an independent Week 1 walkthrough; never mutate the previous save. */
export async function restartFranchiseAtWeekOne(
  fetcher: (path: string, init: RequestInit) => Promise<Response>,
  teamAbbr: string,
  season: number,
) {
  async function request<T>(path: string, body: object, method = 'POST'): Promise<T> {
    const response = await fetcher(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || payload.ok === false)
      throw new Error(payload.error ?? 'Unable to reset to Week 1.');
    return payload;
  }
  const header = await request<SaveBootstrapDTO>('/api/saves/create', {
    teamAbbr,
    year: season,
    fresh: true,
  });
  await request(
    '/api/front-office/state',
    {
      saveId: header.saveId,
      teamAbbr,
      season: header.year,
      selectedPath: 'full',
      simulationPhase: 'week-1',
    },
    'PUT',
  );
  const { state } = await request<{ state: FranchiseSimulationState }>(
    '/api/front-office/simulate',
    { saveId: header.saveId, action: 'initialize', target: 'week-1' },
  );
  if (!state || state.phase !== 'week-1') throw new Error('Unable to initialize Week 1.');
  return { header, state };
}
