import { Storage, digest, utf8 } from './core';
import { JsonTree } from './json-tree';
/** Optional compact history for offline analysis. The live publication adapter
 * retains its original raw event envelopes and schedule. No odds are invented. */
export class OddsSnapshotHistory {
  constructor(readonly s: Storage) {}
  async write(providerEventId: string, asOf: string, value: unknown) {
    if (!providerEventId || !Number.isFinite(Date.parse(asOf)))
      throw Error('Invalid odds snapshot');
    asOf = new Date(asOf).toISOString();
    const root = await new JsonTree(this.s).put(value);
    const hash = await this.s.put({ schema: 1, kind: 'ODDS_HISTORY', providerEventId, asOf, root });
    const id = await digest(utf8.encode(JSON.stringify([providerEventId, asOf])));
    const result = await this.s
      .statement(
        'INSERT INTO app_odds_history(id,provider_event_id,as_of,object_hash) VALUES(?,?,?,?) ON CONFLICT DO NOTHING',
        [id, providerEventId, asOf, hash],
      )
      .run();
    if (!result.meta.changes) {
      const [prior] = await this.s.rows<{ object_hash: string }>(
        'SELECT object_hash FROM app_odds_history WHERE id=?',
        [id],
      );
      if (prior?.object_hash !== hash) throw Error('Odds timestamp identity conflict');
    }
    return { id, hash };
  }
  async read(id: string) {
    const [row] = await this.s.rows<{
      provider_event_id: string;
      as_of: string;
      object_hash: string;
    }>('SELECT provider_event_id,as_of,object_hash FROM app_odds_history WHERE id=?', [id]);
    if (!row) return null;
    const envelope = await this.s.get<any>(row.object_hash);
    if (
      envelope.schema !== 1 ||
      envelope.kind !== 'ODDS_HISTORY' ||
      envelope.providerEventId !== row.provider_event_id ||
      envelope.asOf !== row.as_of
    )
      throw Error('Odds history identity mismatch');
    return {
      providerEventId: row.provider_event_id,
      asOf: row.as_of,
      value: await new JsonTree(this.s).get(envelope.root),
      live: false,
    };
  }
  async page(event: string, before = '9999-12-31T00:00:00.000Z', limit = 20) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw Error('Odds history page limit');
    return this.s.rows<{ id: string; asOf: string }>(
      'SELECT id,as_of AS asOf FROM app_odds_history WHERE provider_event_id=? AND as_of<? ORDER BY as_of DESC LIMIT ?',
      [event, before, limit],
    );
  }
}

export async function readPublishedOddsEvent(
  s: Storage,
  reference: { id: string; hash: string; codec?: string; historyId?: string },
) {
  if (reference.codec === 'ODDS_TREE') {
    const [row] = await s.rows<{ object_hash: string }>(
      'SELECT object_hash FROM app_odds_history WHERE id=?',
      [reference.historyId],
    );
    if (row?.object_hash !== reference.hash) throw Error('Published odds history mismatch');
    const snapshot = await new OddsSnapshotHistory(s).read(reference.historyId!);
    if (!snapshot || snapshot.providerEventId !== reference.id)
      throw Error('Published odds event mismatch');
    return snapshot.value;
  }
  if (reference.codec) throw Error('Unknown published odds codec');
  const event = await s.get<any>(reference.hash);
  if (event.eventID !== reference.id) throw Error('Published odds event mismatch');
  return event;
}
