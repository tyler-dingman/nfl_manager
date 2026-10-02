import type { SaveState } from '@/server/api/store';
import type { FranchiseTransaction } from '@/types/front-office';
/** Only committed roster transactions are eligible. Never create a trade to fill a news slot. */
export function franchiseTransactionsForNews(state: SaveState): FranchiseTransaction[] {
  const players = new Map(
    [...Object.values(state.teamRosters).flat(), ...state.freeAgents, ...state.roster].map((p) => [
      p.id,
      p,
    ]),
  );
  const events = state.transactions.flatMap((tx) => {
    const player = players.get(tx.playerId);
    const team = tx.toTeamAbbr ?? tx.fromTeamAbbr;
    if (!player || !team) return [];
    const name = `${player.firstName} ${player.lastName}`.trim();
    const summary =
      tx.type === 'trade'
        ? `${team} acquires ${name} from ${tx.fromTeamAbbr}`
        : tx.type === 'cut'
          ? `${team} releases ${name}${typeof player.releaseSavings === 'number' && player.releaseSavings > 0 ? `, creating $${player.releaseSavings.toFixed(1)}M in cap space` : ''}`
          : tx.type === 're-sign'
            ? `${team} extends ${name}`
            : tx.type === 'draft'
              ? `${team} drafts ${name}`
              : `${team} signs ${name}`;
    return [
      {
        id: tx.id,
        type: tx.type,
        teamAbbr: team,
        relatedTeamAbbr: tx.fromTeamAbbr,
        playerId: tx.playerId,
        playerName: name,
        playerRating: player.rating ?? player.maddenRating ?? player.baselineRating ?? 0,
        summary,
        createdAt: tx.createdAt,
      },
    ];
  });
  // One committed deal can transfer several players; render it as one story.
  const grouped = new Map<string, FranchiseTransaction[]>();
  for (const event of events) {
    const key =
      event.type === 'trade'
        ? `trade:${event.createdAt}:${[event.teamAbbr, event.relatedTeamAbbr].sort().join(':')}`
        : event.id;
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }
  return [...grouped.entries()].map(([key, group]) =>
    group[0].type === 'trade'
      ? {
          ...group[0],
          id: key,
          playerRating: Math.max(...group.map((e) => e.playerRating ?? 0)),
          summary: group.map((e) => e.summary).join('; '),
        }
      : group[0],
  );
}
