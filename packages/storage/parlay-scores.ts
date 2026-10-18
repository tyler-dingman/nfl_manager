import { Storage, digest, utf8 } from './core';
const context = (
  opponents: Record<string, string>,
  season?: number,
  teams?: { homeTeamId: string; awayTeamId: string },
) =>
  JSON.stringify([
    Object.entries(opponents).sort(([a], [b]) => a.localeCompare(b)),
    season ?? null,
    teams?.homeTeamId ?? null,
    teams?.awayTeamId ?? null,
  ]);
export class PrecomputedProps {
  constructor(readonly s: Storage) {}
  async sources(event: string) {
    const [head] = await this.s.rows<{ markets_hash: string }>(
        'SELECT markets_hash FROM app_sportsbook_events WHERE id=?',
        [event],
      ),
      [version] = await this.s.rows<{ version: number }>(
        'SELECT version FROM app_reference_version WHERE id=1',
      );
    return { board: head?.markets_hash ?? null, references: version?.version ?? 0 };
  }
  async read(
    event: string,
    model: string,
    opponents: Record<string, string>,
    season?: number,
    teams?: { homeTeamId: string; awayTeamId: string },
  ) {
    const key = await digest(utf8.encode(context(opponents, season, teams))),
      [row] = await this.s.rows<any>(
        'SELECT p.* FROM app_parlay_scores p JOIN app_sportsbook_events e ON e.id=p.event_id WHERE p.event_id=? AND p.model_version=? AND p.context_key=? AND p.board_hash=e.markets_hash AND p.reference_version=coalesce((SELECT version FROM app_reference_version WHERE id=1),0)',
        [event, model, key],
      );
    if (!row) return null;
    const envelope = await this.s.get<any>(row.object_hash);
    if (
      envelope.event !== event ||
      envelope.model !== model ||
      envelope.key !== key ||
      envelope.board !== row.board_hash ||
      envelope.references !== row.reference_version
    )
      throw Error('Precomputed score identity mismatch');
    return envelope.rows as any[];
  }
  async publish(
    event: string,
    model: string,
    opponents: Record<string, string>,
    season: number | undefined,
    teams: { homeTeamId: string; awayTeamId: string } | undefined,
    source: { board: string | null; references: number },
    rows: unknown[],
  ) {
    if (!source.board) throw Error('Missing odds board');
    const key = await digest(utf8.encode(context(opponents, season, teams))),
      hash = await this.s.put({
        schema: 1,
        event,
        model,
        key,
        board: source.board,
        references: source.references,
        rows,
      });
    const result = await this.s
      .statement(
        'INSERT INTO app_parlay_scores(event_id,model_version,context_key,board_hash,reference_version,object_hash,computed_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_sportsbook_events WHERE id=? AND markets_hash=?) AND coalesce((SELECT version FROM app_reference_version WHERE id=1),0)=? ON CONFLICT(event_id,model_version,context_key) DO UPDATE SET board_hash=excluded.board_hash,reference_version=excluded.reference_version,object_hash=excluded.object_hash,computed_at=excluded.computed_at',
        [
          event,
          model,
          key,
          source.board,
          source.references,
          hash,
          Date.now(),
          event,
          source.board,
          source.references,
        ],
      )
      .run();
    if (result.meta.changes !== 1) throw Error('Score sources changed during computation');
    return hash;
  }
}
