import { Storage } from './core';
import { ReferenceData } from './reference';
import { JsonTree } from './json-tree';
import { classifyStoredLine } from '../../src/server/odds/line-classification';
import { normalizeEventMarkets, resolveTeamAbbr } from '../../src/server/odds/normalization';
import type { SportsGameOddsEvent } from '../../src/server/providers/sportsGameOdds';
import type { OddsEventInput } from '../../src/server/odds/repository';
const iso = (v: number | null) => (v == null ? null : new Date(v).toISOString());
export class D1OddsBoard {
  constructor(readonly s: Storage) {}
  private async knownIds(prior: any): Promise<{ normalized_key: string; id: string }[]> {
    if (!prior) return [];
    if (!prior.market_ids_hash)
      return this.s.rows(
        'SELECT normalized_key,id FROM app_sportsbook_market_ids WHERE event_id=?',
        [prior.id],
      );
    const directory = await this.s.get<any>(prior.market_ids_hash);
    if (
      directory.schema !== 1 ||
      directory.eventId !== prior.id ||
      directory.kind !== 'MARKET_IDENTITIES'
    )
      throw Error('Market identity directory mismatch');
    return new JsonTree(this.s).get(directory.root);
  }
  async events(includePast = false) {
    const rows = await this.s.rows<any>(
      includePast
        ? 'SELECT * FROM app_sportsbook_events ORDER BY kickoff_at,id'
        : 'SELECT * FROM app_sportsbook_events WHERE kickoff_at>? ORDER BY kickoff_at,id',
      includePast ? [] : [Date.now()],
    );
    return rows.map((r) => ({
      id: r.id,
      providerEventId: r.provider_event_id,
      season: r.season,
      week: r.week,
      homeTeamId: r.home_team_id,
      awayTeamId: r.away_team_id,
      kickoffAt: iso(r.kickoff_at)!,
      status: r.status,
      marketsLocked: Boolean(r.markets_locked),
      finalSnapshotAt: iso(r.final_snapshot_at),
      refreshed24hAt: iso(r.refreshed_24h_at),
      lastImportedAt: iso(r.last_imported_at),
      asOf: iso(r.as_of),
    }));
  }
  async find(home: string, away: string, season: number) {
    return (
      (await this.events(true)).find(
        (r) => r.homeTeamId === home && r.awayTeamId === away && r.season === season,
      ) ?? null
    );
  }
  async markets(
    event: string,
    filters: {
      marketType?: string;
      playerId?: string;
      sportsbook?: string;
      minLine?: number;
      maxLine?: number;
    } = {},
  ) {
    const [head] = await this.s.rows<{ markets_hash: string | null }>(
      'SELECT markets_hash FROM app_sportsbook_events WHERE id=?',
      [event],
    );
    if (!head?.markets_hash) return [];
    const envelope = await this.s.get<any>(head.markets_hash);
    if (envelope.schema !== 1 || envelope.eventId !== event)
      throw Error('Odds board identity mismatch');
    const rows = await new JsonTree(this.s).get<any[]>(envelope.root);
    return rows.filter(
      (r) =>
        (!filters.marketType || r.marketType === filters.marketType) &&
        (!filters.playerId || r.playerId === filters.playerId) &&
        (!filters.sportsbook || r.sportsbook === filters.sportsbook) &&
        (filters.minLine === undefined || (r.line != null && r.line >= filters.minLine)) &&
        (filters.maxLine === undefined || (r.line != null && r.line <= filters.maxLine)),
    );
  }
  async publish(input: OddsEventInput, rows: any[], asOf: number, id?: string) {
    const [prior] = await this.s.rows<any>(
      'SELECT * FROM app_sportsbook_events WHERE provider_event_id=?',
      [input.providerEventId],
    );
    const eventId = prior?.id ?? id ?? crypto.randomUUID();
    if (id && id !== eventId) throw Error('Original odds event identity conflict');
    const root = await new JsonTree(this.s).put(rows),
      hash = await this.s.put({ schema: 1, eventId, root, asOf });
    if (prior?.as_of > asOf) throw Error('Odds board snapshot superseded');
    if (prior?.markets_hash === hash && prior.as_of === asOf) return eventId;
    const identities = new Map((await this.knownIds(prior)).map((r) => [r.normalized_key, r.id]));
    for (const row of rows) {
      if (!row.id || !row.normalizedKey) throw Error('Market identity required');
      const known = identities.get(row.normalizedKey);
      if (known && known !== row.id) throw Error('Original market identity conflict');
      identities.set(row.normalizedKey, row.id);
    }
    if (new Set(identities.values()).size !== identities.size)
      throw Error('Repeated market identity');
    const identityRoot = await new JsonTree(this.s).put(
      [...identities]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([normalized_key, id]) => ({ normalized_key, id })),
    );
    const identityHash = await this.s.put({
      schema: 1,
      kind: 'MARKET_IDENTITIES',
      eventId,
      root: identityRoot,
    });
    const nonce = crypto.randomUUID(),
      version = prior?.version ?? 0;
    const statements = [
      this.s.statement(
        'INSERT INTO app_sportsbook_events(id,provider_event_id,season,week,home_team_id,away_team_id,kickoff_at,status,markets_locked,last_imported_at,markets_hash,as_of,market_ids_hash,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(provider_event_id) DO UPDATE SET season=excluded.season,week=excluded.week,home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,kickoff_at=excluded.kickoff_at,status=excluded.status,last_imported_at=excluded.last_imported_at,markets_hash=excluded.markets_hash,as_of=excluded.as_of,market_ids_hash=excluded.market_ids_hash,version=version+1 WHERE version=? AND as_of<=excluded.as_of',
        [
          eventId,
          input.providerEventId,
          input.season,
          input.week,
          input.homeTeamId,
          input.awayTeamId,
          input.kickoffAt.getTime(),
          input.status,
          prior?.markets_locked ?? 0,
          asOf,
          hash,
          asOf,
          identityHash,
          version,
        ],
      ),
      this.s.guard(nonce),
      this.s.unguard(nonce),
    ];
    statements.push(
      this.s.statement(
        'INSERT INTO app_odds_board_history(event_id,as_of,object_hash) VALUES(?,?,?) ON CONFLICT DO NOTHING',
        [eventId, asOf, hash],
      ),
    );
    await this.s.batch(statements);
    return eventId;
  }
  async publishProvider(event: SportsGameOddsEvent, asOf: number) {
    const home = resolveTeamAbbr(event.teams?.home),
      away = resolveTeamAbbr(event.teams?.away),
      starts = String(
        event.status?.startsAt ??
          event.status?.startTime ??
          event.startsAt ??
          event.startTime ??
          '',
      );
    if (!home || !away || !Number.isFinite(Date.parse(starts)))
      throw Error('Provider event lacks verified teams/kickoff');
    const [prior] = await this.s.rows<any>(
        'SELECT * FROM app_sportsbook_events WHERE provider_event_id=?',
        [event.eventID],
      ),
      known = await this.knownIds(prior);
    const ids = new Map(known.map((r) => [r.normalized_key, r.id])),
      rows: any[] = [];
    for (const market of normalizeEventMarkets(event).markets) {
      const id = ids.get(market.normalizedKey) ?? crypto.randomUUID();
      ids.set(market.normalizedKey, id);
      const rawPlayer = event.players?.[market.entityId] as any;
      for (const price of market.prices)
        rows.push({
          id,
          marketType: market.marketType,
          statId: market.statId,
          entityId: market.entityId,
          playerId: market.playerId,
          playerName: rawPlayer?.name ?? rawPlayer?.names?.long ?? null,
          teamId: market.teamId,
          period: market.period,
          side: market.side,
          line: market.line,
          normalizedKey: market.normalizedKey,
          isAltLine: market.isAltLine,
          sportsbook: price.sportsbook,
          odds: price.odds,
          available: price.available,
          deeplink: price.deeplink,
          ...classifyStoredLine({
            sportsbook: price.sportsbook,
            line: market.line,
            isAltLine: market.isAltLine,
            rawProviderMetadata: market.rawProviderMetadata,
          }),
        });
    }
    const season = Number(
      event.season ?? (event.info as any)?.season ?? new Date(starts).getUTCFullYear(),
    );
    let week = Number(event.week ?? (event.info as any)?.week ?? 0);
    if (!week) {
      const schedule = await new ReferenceData(this.s).games([season]);
      const game = schedule.find(
        (g) =>
          g.seasonType === 'REG' &&
          g.homeTeam === home &&
          g.awayTeam === away &&
          g.kickoffAt &&
          Math.abs(Date.parse(g.kickoffAt) - Date.parse(starts)) <= 36 * 3600000,
      );
      week = game?.week ?? 0;
    }
    if (!Number.isInteger(season) || !Number.isInteger(week) || week < 1)
      throw Error('Provider season/week unavailable');
    return this.publish(
      {
        providerEventId: event.eventID,
        season,
        week,
        homeTeamId: home,
        awayTeamId: away,
        kickoffAt: new Date(starts),
        status: String(event.status?.status ?? 'scheduled'),
      },
      rows,
      asOf,
    );
  }
  async priceHistory(event: string, asOf: string, includeAll = false) {
    const rows = await this.s.rows<{ object_hash: string; as_of: number }>(
      'SELECT object_hash,as_of FROM app_odds_board_history WHERE event_id=? AND as_of<=? ORDER BY as_of',
      [event, Date.parse(asOf)],
    );
    const result: any[] = [];
    for (const row of rows) {
      const envelope = await this.s.get<any>(row.object_hash);
      if (envelope.eventId !== event) throw Error('Historical board identity mismatch');
      for (const m of await new JsonTree(this.s).get<any[]>(envelope.root))
        if (includeAll || (m.period === 'game' && !m.isAltLine && m.available && m.line != null))
          result.push({
            marketId: m.id,
            available: m.available,
            playerId: m.playerId,
            marketType: m.marketType,
            side: m.side,
            sportsbook: m.sportsbook,
            line: m.line,
            odds: m.odds,
            capturedAt: new Date(row.as_of).toISOString(),
          });
    }
    return result;
  }
}
