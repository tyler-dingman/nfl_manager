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

export type CompleteSavedSelection = {
  providerMarketId: string;
  providerPlayerId: string;
  providerSelectionId: string;
  marketId: string;
  playerId: string;
  sportsbook: string;
  selection: string;
  line: number;
  odds: number;
};
/** Opt-in owner preparation only. Legacy boards without frozen provider identity
 * cannot qualify. A verified copy still does NOT authorize releasing its board. */
export async function prepareCompleteSavedOddsEvidence(
  s: Storage,
  input: {
    eventId: string;
    boardHash: string;
    providerEventId: string;
    sourceIdentity: string;
    asOf: number;
    selections: CompleteSavedSelection[];
  },
) {
  const board = await s.get<any>(input.boardHash);
  if (
    !input.sourceIdentity?.trim() ||
    !input.providerEventId?.trim() ||
    board.sourceIdentity !== input.sourceIdentity ||
    board.providerEventId !== input.providerEventId ||
    board.eventId !== input.eventId ||
    board.asOf !== input.asOf
  )
    throw Error('Saved evidence requires verified frozen source identity and timestamp');
  if (
    board.schema !== 1 ||
    !Number.isSafeInteger(board.asOf) ||
    board.asOf < 0 ||
    !Array.isArray(input.selections) ||
    input.selections.length < 1 ||
    input.selections.length > 50
  )
    throw Error('Invalid complete saved selections');
  const keys = input.selections.map((x) =>
    JSON.stringify([x.marketId, x.playerId, x.sportsbook, x.selection, x.line, x.odds]),
  );
  if (new Set(keys).size !== keys.length) throw Error('Duplicate saved selections');
  const rows = await new JsonTree(s).get<any[]>(board.root);
  if (!Array.isArray(rows)) throw Error('Invalid source markets');
  const markets = input.selections.map((selection) => {
    const matches = rows.filter(
      (row) =>
        row.id === selection.marketId &&
        row.playerId === selection.playerId &&
        row.sportsbook === selection.sportsbook &&
        row.side === selection.selection &&
        row.line === selection.line &&
        row.odds === selection.odds,
    );
    if (matches.length !== 1)
      throw Error('Saved selection does not match unique original source evidence');
    const row = matches[0];
    for (const key of ['providerMarketId', 'providerPlayerId', 'providerSelectionId'] as const)
      if (
        typeof selection[key] !== 'string' ||
        !selection[key].trim() ||
        row[key] !== selection[key]
      )
        throw Error('Incomplete original provider selection identity');
    for (const key of ['id', 'playerId', 'sportsbook', 'marketType', 'normalizedKey', 'side'])
      if (typeof row[key] !== 'string' || !row[key]) throw Error('Incomplete original selection');
    if (!Number.isFinite(row.line) || !Number.isFinite(row.odds) || row.available !== true)
      throw Error('Incomplete original price');
    return row;
  });
  const value = {
    schema: 2,
    kind: 'VERIFIED_SAVED_ODDS_EVIDENCE',
    eventId: input.eventId,
    providerEventId: input.providerEventId,
    sourceIdentity: input.sourceIdentity,
    asOf: input.asOf,
    boardHash: input.boardHash,
    selections: input.selections,
    markets,
  };
  const hash = await s.put(value);
  if (JSON.stringify(await s.get(hash)) !== JSON.stringify(value))
    throw Error('Complete evidence read-back mismatch');
  return { hash, value, boardReleaseAuthorized: false as const };
}
