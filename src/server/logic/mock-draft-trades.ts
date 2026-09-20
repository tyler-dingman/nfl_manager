import { generateMockTradeOpportunity, tradeYear } from '@/lib/mock-draft-trades';
import { buildTeamContexts } from '@/server/logic/trade-offer-generator';
import { getTeamTradeAssets, type SaveState } from '@/server/api/store';
import type { DraftSessionDTO } from '@/types/draft';

export function updateMockDraftTrades(session: DraftSessionDTO, state: SaveState) {
  if (session.mode !== 'mock') return;
  if (!session.tradeState) {
    const year = tradeYear(session);
    getTeamTradeAssets(state, session.userTeamAbbr);
    session.tradeState = {
      futurePicks: state.draftPickAssets
        .filter((p) => p.year > year && p.year <= year + 2)
        .map((p) => ({ ...p })),
      needs: Object.fromEntries(
        [...buildTeamContexts(state)].map(([abbr, context]) => [abbr, context.needs]),
      ),
      offers: [],
      history: [],
      evaluatedPicks: [],
      lastOfferPick: -10,
    };
  }
  generateMockTradeOpportunity(session);
}
