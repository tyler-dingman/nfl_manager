import { Storage } from './core';
import type { CanonicalGame } from '../../src/lib/canonical-game';
import type {
  HistoricalPlayerGame,
  TeamSeasonStrength,
} from '../../src/server/historical-stats/types';
export class ReferenceData {
  constructor(readonly s: Storage) {}
  async put(
    namespace: string,
    id: string,
    subject: string,
    season: number,
    value: unknown,
    metadata: unknown = {},
  ) {
    const hash = await this.s.put({ schema: 1, namespace, id, value });
    await this.s.batch([
      this.s.statement(
        'INSERT INTO app_reference_packs(namespace,id,subject,season,metadata_json,object_hash) VALUES(?,?,?,?,?,?) ON CONFLICT(namespace,id) DO UPDATE SET subject=excluded.subject,season=excluded.season,metadata_json=excluded.metadata_json,object_hash=excluded.object_hash WHERE subject IS NOT excluded.subject OR season IS NOT excluded.season OR metadata_json IS NOT excluded.metadata_json OR object_hash IS NOT excluded.object_hash',
        [namespace, id, subject, season, JSON.stringify(metadata), hash],
      ),
      this.s.statement(
        'INSERT INTO app_reference_version(id,version) SELECT 1,1 WHERE changes()>0 ON CONFLICT(id) DO UPDATE SET version=version+1',
      ),
    ]);
    return hash;
  }
  async values<T>(namespace: string, where = '1', values: unknown[] = []): Promise<T[]> {
    const rows = await this.s.rows<{ id: string; object_hash: string }>(
      'SELECT id,object_hash FROM app_reference_packs WHERE namespace=? AND ' + where,
      [namespace, ...values],
    );
    const result: T[] = [];
    for (let i = 0; i < rows.length; i += 6)
      for (const value of await Promise.all(
        rows.slice(i, i + 6).map(async (row) => {
          const envelope = await this.s.get<any>(row.object_hash);
          if (envelope.schema !== 1 || envelope.namespace !== namespace || envelope.id !== row.id)
            throw Error('Reference pack identity mismatch');
          return envelope.value as T;
        }),
      ))
        result.push(value);
    return result;
  }
  async games(seasons: number[]) {
    return (
      await this.values<CanonicalGame[]>('SCHEDULE', 'season IN(SELECT value FROM json_each(?))', [
        JSON.stringify(seasons),
      ])
    )
      .flat()
      .sort(
        (a, b) => (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? '') || a.id.localeCompare(b.id),
      );
  }
  async nextGame(team: string, now = new Date()) {
    const games = (
      await this.values<CanonicalGame[]>('SCHEDULE', 'season>=?', [now.getUTCFullYear() - 1])
    )
      .flat()
      .filter(
        (g) =>
          (g.homeTeam === team || g.awayTeam === team) &&
          g.status === 'SCHEDULED' &&
          g.kickoffAt &&
          Date.parse(g.kickoffAt) > now.getTime(),
      )
      .sort((a, b) => a.kickoffAt!.localeCompare(b.kickoffAt!) || a.id.localeCompare(b.id));
    return games[0] ?? null;
  }
  async playerGames(players: string[], seasons: number[]) {
    if (!players.length) return [];
    return (
      await this.values<HistoricalPlayerGame[]>(
        'PLAYER_GAMES',
        'subject IN(SELECT value FROM json_each(?)) AND season IN(SELECT value FROM json_each(?))',
        [JSON.stringify(players), JSON.stringify(seasons)],
      )
    )
      .flat()
      .sort((a, b) => b.date.localeCompare(a.date) || b.week - a.week);
  }
  async strength(team: string, season: number) {
    return (
      (
        await this.values<TeamSeasonStrength>('TEAM_STRENGTH', 'subject=? AND season=?', [
          team,
          season,
        ])
      )[0] ?? null
    );
  }
  async opponentGames(opponent: string, position: string, seasons: number[]) {
    return (
      await this.values<HistoricalPlayerGame[]>(
        'OPPONENT_GAMES',
        'subject=? AND season IN(SELECT value FROM json_each(?))',
        [opponent + ':' + position, JSON.stringify(seasons)],
      )
    )
      .flat()
      .sort((a, b) => b.date.localeCompare(a.date) || b.week - a.week);
  }
  async researchPlayers(teams: string[], year = new Date().getUTCFullYear()) {
    if (!teams.length) return [];
    const rows = await this.s.rows<{ subject: string }>(
      "SELECT DISTINCT subject FROM app_reference_packs p WHERE namespace='PLAYER_GAMES' AND season>=? AND json_extract(metadata_json,'$.position') IN('QB','RB','WR','TE') AND EXISTS(SELECT 1 FROM json_each(p.metadata_json,'$.teams') WHERE value IN(SELECT value FROM json_each(?)))",
      [year - 1, JSON.stringify(teams)],
    );
    return rows.map((r) => r.subject);
  }
  async roles(teams: string[], asOf: string) {
    const packs = await this.values<{
      observations: any[];
      coverageAt: string | null;
      teamIds: string[];
    }>('ROLE_EVIDENCE');
    const observations = packs
      .flatMap((p) => p.observations)
      .filter(
        (o) =>
          teams.includes(o.teamId) &&
          Date.parse(o.sourceAt) <= Date.parse(asOf) &&
          Date.parse(o.receivedAt) <= Date.parse(asOf) &&
          Date.parse(o.sourceAt) > Date.parse(asOf) - 21 * 86400000,
      );
    const coverageAt =
      packs
        .filter(
          (p) =>
            p.coverageAt &&
            Date.parse(p.coverageAt) <= Date.parse(asOf) &&
            teams.every((t) => p.teamIds.includes(t)),
        )
        .map((p) => p.coverageAt!)
        .sort()
        .at(-1) ?? null;
    return { observations, coverageAt };
  }
}
