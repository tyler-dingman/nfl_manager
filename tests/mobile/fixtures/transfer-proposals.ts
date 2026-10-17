import type { Sportsbook, TransferProposal } from '../../../packages/parlay/sportsbook-transfer';
export function fixtureProposal(
  ids: string[],
  book: Sportsbook,
  adjusted = false,
  native = false,
  unpriced = false,
): TransferProposal {
  return {
    sportsbook: book,
    adjustments: adjusted ? 1 : 0,
    estimatedOdds: unpriced ? null : book === 'draftkings' ? 150 : -350,
    token: `fixture-${book}-${ids.join('-')}`,
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    matches: ids.map((id, i) => {
      const original = {
        id,
        eventId: `event-${i}`,
        playerId: `player-${i}`,
        playerName: native ? 'Player One' : `Player ${i}`,
        marketType: 'RECEPTIONS',
        period: 'game',
        side: 'OVER',
        line: 4.5,
        odds: -200,
        sportsbook: 'FANDUEL',
        available: true,
      };
      return {
        original,
        selection: {
          ...original,
          id: adjusted && i === 0 ? 'adjusted-' + id : id,
          line: adjusted && i === 0 ? 3.5 : 4.5,
          odds: unpriced ? null : book === 'draftkings' ? 150 : -350,
          pricingStatus: unpriced ? 'unknown' : 'stored',
          available: !unpriced,
          sportsbook: book.toUpperCase(),
        },
        adjusted: adjusted && i === 0,
      };
    }),
  };
}
