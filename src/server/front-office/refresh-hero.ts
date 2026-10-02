import { getSaveStateResult } from '@/server/api/store';
import { franchiseTransactionsForNews } from './transaction-news';
import { generateFrontOfficeEvents } from './event-engine';
import { NextRequest } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { getFrontOfficeSaveMetadata, saveFranchiseSimulation } from './repository';
/** A successful roster action must not be retried just because a cover refresh failed.
 * The next authenticated franchise read also re-evaluates the same authoritative state. */
export async function refreshFranchiseHeroAfterAction(request: Request, saveId: string) {
  try {
    const user = await currentUser(new NextRequest(request.url, { headers: request.headers }));
    if (!user) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      const metadata = await getFrontOfficeSaveMetadata(user.id, saveId);
      if (!metadata?.simulation) return;
      const simulation = structuredClone(metadata.simulation);
      const state = getSaveStateResult(saveId);
      if (state.ok) {
        const transactions = new Map(simulation.transactions.map((tx) => [tx.id, tx]));
        franchiseTransactionsForNews(state.data).forEach((tx) => transactions.set(tx.id, tx));
        simulation.transactions = [...transactions.values()];
      }
      const events = generateFrontOfficeEvents({
        saveId,
        teamAbbr: metadata.teamAbbr,
        previous: metadata.simulation,
        current: simulation,
      });
      const saved = await saveFranchiseSimulation({
        userId: user.id,
        saveId,
        expectedVersion: metadata.version ?? 1,
        simulation,
        events,
      });
      if (saved) return events;
    }
    throw new Error(
      'Concurrent franchise updates prevented News persistence after three attempts.',
    );
  } catch (error) {
    console.error('[front-office:action-news] Failed to persist committed action news', error);
    // Completed roster actions are not repeated; the next advance reconciles their transaction IDs.
  }
}
