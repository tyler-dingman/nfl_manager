import { Storage } from './core';
import { ReferenceData } from './reference';
import { NFL_LEAGUE_DATA } from '../../src/server/data/nfl-data';
import { normalizePlayerName } from '../../src/server/ingest/normalize';
import type { CanonicalGame } from '../../src/lib/canonical-game';
const aliases: Record<string, string> = {
    JAC: 'JAX',
    KAN: 'KC',
    LVR: 'LV',
    OAK: 'LV',
    SD: 'LAC',
    STL: 'LAR',
    LA: 'LAR',
    WSH: 'WAS',
  },
  team = (s: string) => aliases[s.toUpperCase()] ?? s.toUpperCase(),
  num = (v: unknown) =>
    v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const gameKey = (g: CanonicalGame) =>
  [g.season, g.seasonType, g.week, g.homeTeam, g.awayTeam].join(':');
/** Complete validated source batches are merged by canonical identities. Existing
 * R2 reference packs and exact PostgreSQL exports remain available for rollback. */
export class D1HistoryIngestion {
  readonly refs: ReferenceData;
  constructor(readonly s: Storage) {
    this.refs = new ReferenceData(s);
  }
  private locked = false;
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.locked) return operation();
    const nonce = crypto.randomUUID(),
      now = Date.now(),
      claim = await this.s
        .statement(
          'INSERT INTO app_reference_import_lock(id,nonce,expires_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET nonce=excluded.nonce,expires_at=excluded.expires_at WHERE expires_at<? RETURNING nonce',
          [nonce, now + 4 * 3600000, now],
        )
        .first();
    if (!claim) throw Error('A reference ingestion is already active. Retry after it completes.');
    this.locked = true;
    try {
      return await operation();
    } finally {
      this.locked = false;
      await this.s
        .statement('DELETE FROM app_reference_import_lock WHERE id=1 AND nonce=?', [nonce])
        .run();
    }
  }
  schedules(games: CanonicalGame[]) {
    return this.exclusive(() => this.writeSchedules(games));
  }
  persistNflverse(...args: Parameters<D1HistoryIngestion['writeNflverse']>) {
    return this.exclusive(() => this.writeNflverse(...args));
  }
  calculateTeamSeasonStrength(season: number) {
    return this.exclusive(() => this.writeStrength(season));
  }
  private async writeSchedules(games: CanonicalGame[]) {
    const seasons = [...new Set(games.map((g) => g.season))],
      old = await this.refs.games(seasons),
      known = new Map(old.map((g) => [gameKey(g), g]));
    for (const g of games) {
      const prior = known.get(gameKey(g));
      known.set(gameKey(g), { ...g, id: prior?.id ?? g.id });
    }
    for (const season of seasons)
      await this.refs.put(
        'SCHEDULE',
        `canonical:${season}`,
        'NFL',
        season,
        [...known.values()].filter((g) => g.season === season),
      );
    return [...known.values()];
  }
  private async writeNflverse(
    options: { seasons: number[]; playersOnly?: boolean; teamsOnly?: boolean },
    gamesRaw: Record<string, string>[],
    playersRaw: Record<string, string>[],
  ) {
    const schedule = gamesRaw.map(
        (g) =>
          ({
            id: crypto.randomUUID(),
            season: Number(g.season),
            seasonType: g.game_type as 'REG' | 'POST',
            week: Number(g.week),
            homeTeam: team(g.home_team),
            awayTeam: team(g.away_team),
            kickoffAt: g.gameday && g.gametime ? `${g.gameday}T${g.gametime}:00-05:00` : null,
            kickoffConfirmed: Boolean(g.gametime),
            status: g.home_score !== '' && g.away_score !== '' ? 'FINAL' : 'SCHEDULED',
            homeScore: num(g.home_score),
            awayScore: num(g.away_score),
            overtime: Number(g.overtime) > 0,
            venue: g.stadium ?? null,
            broadcastNetwork: null,
            providerGameId: g.game_id,
            gameDate: g.gameday,
          }) as CanonicalGame & { providerGameId: string; gameDate: string },
      ),
      prior = await this.refs.games(options.seasons),
      byKey = new Map(prior.map((g) => [gameKey(g), g]));
    // ESPN-confirmed kickoffs keep their original time/provider link during stats imports.
    const merged = await this.schedules(
      schedule.map((g) => {
        const p = byKey.get(gameKey(g));
        return p?.providerEventId
          ? {
              ...g,
              id: p.id,
              kickoffAt: p.kickoffAt,
              kickoffConfirmed: p.kickoffConfirmed,
              providerEventId: p.providerEventId,
            }
          : g;
      }),
    );
    const gamesBySide = new Map<string, any>();
    for (const g of gamesRaw) {
      const match = merged.find(
        (m) =>
          gameKey(m) ===
          [g.season, g.game_type, g.week, team(g.home_team), team(g.away_team)].join(':'),
      );
      if (match)
        for (const t of [team(g.home_team), team(g.away_team)])
          gamesBySide.set(`${g.season}:${g.week}:${g.game_type}:${t}`, { raw: g, game: match });
    }
    const mappings = new Map(
        (await this.refs.values<any[]>('NFLVERSE_PLAYER_MAPPINGS'))
          .flat()
          .map((m) => [m.providerPlayerId, m]),
      ),
      unmatched = new Map<string, any>(),
      mapped = new Set<string>(),
      logs: any[] = [];
    const stat = (r: Record<string, string>, key: string, legacy?: string) =>
      num(r[key] ?? (legacy ? r[legacy] : undefined));
    for (const raw of playersRaw) {
      const own = team(raw.recent_team || raw.team),
        match = gamesBySide.get(`${raw.season}:${raw.week}:${raw.season_type}:${own}`);
      if (!match) continue;
      const name = raw.player_display_name || raw.player_name,
        position = raw.position || raw.position_group;
      let id = mappings.get(raw.player_id)?.playerId ?? null,
        confidence = id ? 'EXACT_ID' : null;
      if (!id) {
        const normalized = normalizePlayerName(name),
          loose = NFL_LEAGUE_DATA.players.filter(
            (p) => normalizePlayerName(p.name) === normalized && p.position === position,
          ),
          strict = loose.filter((p) => p.teamAbbr === own);
        if (strict.length === 1 || (!strict.length && loose.length === 1)) {
          id = (strict[0] ?? loose[0])!.id;
          confidence = strict.length ? 'NAME_TEAM_POSITION' : 'NAME_POSITION';
        } else
          unmatched.set(raw.player_id, {
            provider_player_id: raw.player_id,
            provider_name: name,
            team: own,
            position,
            season: Number(raw.season),
            week: Number(raw.week),
            reason: strict.length > 1 || loose.length > 1 ? 'ambiguous match' : 'no match',
            possible_matches: (strict.length ? strict : loose)
              .map((p) => `${p.id}:${p.name}:${p.teamAbbr}`)
              .join('|'),
          });
      }
      if (id) {
        mapped.add(raw.player_id);
        mappings.set(raw.player_id, {
          providerPlayerId: raw.player_id,
          playerId: id,
          providerName: name,
          confidence,
        });
      }
      const g = match.game,
        log = {
          gameId: g.id,
          date: match.raw.gameday,
          kickoffAt: g.kickoffAt,
          season: Number(raw.season),
          week: Number(raw.week),
          seasonType: raw.season_type,
          playerId: id,
          providerPlayerId: raw.player_id,
          playerName: name,
          teamId: own,
          opponentTeamId: g.homeTeam === own ? g.awayTeam : g.homeTeam,
          homeTeamId: g.homeTeam,
          homeAway: g.homeTeam === own ? 'HOME' : 'AWAY',
          position,
          passingAttempts: stat(raw, 'attempts'),
          passingCompletions: stat(raw, 'completions'),
          passingYards: stat(raw, 'passing_yards'),
          passingTds: stat(raw, 'passing_tds'),
          interceptions: stat(raw, 'passing_interceptions', 'interceptions'),
          sacksTaken: stat(raw, 'sacks_suffered', 'sacks'),
          carries: stat(raw, 'carries'),
          rushingYards: stat(raw, 'rushing_yards'),
          rushingTds: stat(raw, 'rushing_tds'),
          targets: stat(raw, 'targets'),
          receptions: stat(raw, 'receptions'),
          receivingYards: stat(raw, 'receiving_yards'),
          receivingTds: stat(raw, 'receiving_tds'),
          fumbles:
            stat(raw, 'rushing_fumbles') == null && stat(raw, 'receiving_fumbles') == null
              ? null
              : (stat(raw, 'rushing_fumbles') ?? 0) + (stat(raw, 'receiving_fumbles') ?? 0),
          fumblesLost:
            stat(raw, 'rushing_fumbles_lost') == null && stat(raw, 'receiving_fumbles_lost') == null
              ? null
              : (stat(raw, 'rushing_fumbles_lost') ?? 0) +
                (stat(raw, 'receiving_fumbles_lost') ?? 0),
          fantasyPoints: stat(raw, 'fantasy_points'),
        };
      logs.push(log);
    }
    await this.refs.put('NFLVERSE_PLAYER_MAPPINGS', 'canonical', 'NFL', 0, [...mappings.values()]);
    await this.refs.put('NFLVERSE_UNMATCHED', 'last-import', 'NFL', 0, [...unmatched.values()]);
    const strengthRecords: Record<number, number> = {};
    for (const season of options.seasons) {
      const incoming = logs.filter((l) => l.season === season),
        all = await this.refs.values<any[]>('NFLVERSE_RAW_GAMES', 'season=?', [season]),
        stored = new Map(all.flat().map((l) => [[l.gameId, l.providerPlayerId].join(':'), l]));
      for (const l of incoming) stored.set([l.gameId, l.providerPlayerId].join(':'), l);
      const rows = [...stored.values()];
      await this.refs.put('NFLVERSE_RAW_GAMES', `canonical:${season}`, 'NFL', season, rows);
      if (!options.playersOnly) {
        const teamGames: any[] = [];
        for (const g of merged.filter((g) => g.season === season))
          for (const own of [g.homeTeam, g.awayTeam]) {
            const data = rows.filter((l) => l.gameId === g.id && l.teamId === own),
              sum = (key: string) =>
                data.some((r) => r[key] != null)
                  ? data.reduce((n, r) => n + (r[key] ?? 0), 0)
                  : null;
            teamGames.push({
              gameId: g.id,
              season,
              seasonType: g.seasonType,
              week: g.week,
              teamId: own,
              opponentTeamId: g.homeTeam === own ? g.awayTeam : g.homeTeam,
              points: g.homeTeam === own ? g.homeScore : g.awayScore,
              passingYards: sum('passingYards'),
              passingTds: sum('passingTds'),
              rushingYards: sum('rushingYards'),
              rushingTds: sum('rushingTds'),
              receivingYards: sum('receivingYards'),
              receptions: sum('receptions'),
            });
          }
        await this.refs.put('TEAM_GAMES', `canonical:${season}`, 'NFL', season, teamGames);
        strengthRecords[season] = await this.calculateTeamSeasonStrength(season);
      }
      if (!options.teamsOnly) {
        for (const id of new Set(rows.map((l) => l.playerId).filter(Boolean))) {
          const values = rows.filter((l) => l.playerId === id);
          await this.refs.put('PLAYER_GAMES', `canonical:${season}:${id}`, id, season, values, {
            position: values[0].position,
            teams: [...new Set(values.map((l) => l.teamId))],
          });
        }
        for (const key of new Set(rows.map((l) => l.opponentTeamId + ':' + l.position))) {
          const values = rows.filter(
            (l) => l.opponentTeamId + ':' + l.position === key && l.playerId,
          );
          await this.refs.put('OPPONENT_GAMES', `canonical:${season}:${key}`, key, season, values);
        }
      }
    }
    return {
      games: gamesRaw.length,
      playerRows: logs.length,
      teamRows: options.playersOnly ? 0 : gamesRaw.length * 2,
      mappedPlayers: mapped.size,
      unmatchedPlayers: unmatched.size,
      errors: 0,
      dryRun: false,
      strengthRecords,
    };
  }
  private async writeStrength(season: number) {
    const rows = (await this.refs.values<any[]>('TEAM_GAMES', 'season=?', [season]))
        .flat()
        .filter((g) => g.seasonType === 'REG'),
      teams = [...new Set(rows.map((r) => r.teamId))],
      summaries = teams.flatMap((teamId) => {
        const own = rows.filter((r) => r.teamId === teamId),
          opponents = own.flatMap((g) => {
            const opp = rows.find((r) => r.gameId === g.gameId && r.teamId === g.opponentTeamId);
            return opp ? [opp] : [];
          });
        if (!opponents.length) return [];
        const avg = (values: any[], key: string) => {
          const n = values.map((v) => v[key]).filter((v) => v != null);
          return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
        };
        return [
          {
            season,
            teamId,
            games: own.length,
            pointsAllowedPerGame: avg(opponents, 'points'),
            passingYardsAllowedPerGame: opponents.reduce((n,r)=>n+(r.passingYards??r.receivingYards??0),0)/opponents.length,
            rushingYardsAllowedPerGame: opponents.reduce((n,r)=>n+(r.rushingYards??0),0)/opponents.length,
            totalYardsAllowedPerGame:
              opponents.reduce(
                (n, r) => n + (r.passingYards ?? r.receivingYards ?? 0) + (r.rushingYards ?? 0),
                0,
              ) / opponents.length,
          },
        ];
      });
    const rank = (r: any, key: string) =>
      [...summaries]
        .sort(
          (a: any, b: any) =>
            (a[key] ?? Infinity) - (b[key] ?? Infinity) || a.teamId.localeCompare(b.teamId),
        )
        .findIndex((t) => t.teamId === r.teamId) + 1;
    for (const r of summaries)
      await this.refs.put('TEAM_STRENGTH', `canonical:${season}:${r.teamId}`, r.teamId, season, {
        ...r,
        passDefenseRank: rank(r, 'passingYardsAllowedPerGame'),
        rushDefenseRank: rank(r, 'rushingYardsAllowedPerGame'),
        scoringDefenseRank: rank(r, 'pointsAllowedPerGame'),
        totalDefenseRank: rank(r, 'totalYardsAllowedPerGame'),
      });
    return summaries.length;
  }
}
