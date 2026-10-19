import { Storage } from './core';
import { JsonTree } from './json-tree';

/** Owner-only evidence preparation experiment. Never releases a board reference,
 * changes a saved selection, or authorizes retention deletion. */
export async function prepareSavedOddsEvidence(
  s: Storage,
  eventId: string,
  boardHash: string,
  marketIds: string[],
) {
  if (
    !eventId ||
    marketIds.length < 1 ||
    marketIds.length > 50 ||
    new Set(marketIds).size !== marketIds.length
  )
    throw Error('Invalid saved selections');
  const board = await s.get<any>(boardHash);
  if (
    board.schema !== 1 ||
    board.eventId !== eventId ||
    !Number.isSafeInteger(board.asOf) ||
    board.asOf < 0
  )
    throw Error('Invalid source board identity');
  const rows = await new JsonTree(s).get<any[]>(board.root);
  if (!Array.isArray(rows)) throw Error('Invalid source markets');
  const selected = marketIds.map((id) => {
    const matches = rows.filter((row) => row?.id === id);
    if (matches.length !== 1) throw Error('Missing or ambiguous saved market');
    const row = matches[0];
    // Only complete player props qualify. Unknown/legacy formats fail closed.
    for (const field of ['id', 'playerId', 'sportsbook', 'marketType', 'side', 'normalizedKey'])
      if (typeof row[field] !== 'string' || !row[field]) throw Error('Incomplete saved market');
    if (!Number.isFinite(row.line) || !Number.isFinite(row.odds) || row.available !== true)
      throw Error('Incomplete saved price');
    return row; // Preserve every source field, not a lossy whitelist.
  });
  const value = {
    schema: 1,
    kind: 'PREPARED_SAVED_ODDS_EVIDENCE',
    eventId,
    boardHash,
    asOf: board.asOf,
    selectedIds: marketIds,
    markets: selected,
  };
  const hash = await s.put(value);
  const restored = await s.get(hash);
  if (JSON.stringify(restored) !== JSON.stringify(value))
    throw Error('Saved evidence read-back mismatch');
  return { hash, value };
}
