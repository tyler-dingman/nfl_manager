import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { authDb } from '@/server/auth/database';
import { normalizePlayerName } from '@/server/ingest/normalize';
import { calculateTeamSeasonStrengths } from './team-season-strength-service';

const GAMES_URL = 'https://github.com/nflverse/nfldata/raw/master/data/games.csv';
const PLAYER_STATS_URL = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`;
const TEAM_CODES: Record<string, string> = {
  JAC: 'JAX',
  JAX: 'JAX',
  KAN: 'KC',
  KC: 'KC',
  LVR: 'LV',
  OAK: 'LV',
  LV: 'LV',
  SD: 'LAC',
  LAC: 'LAC',
  STL: 'LAR',
  LA: 'LAR',
  LAR: 'LAR',
  WAS: 'WAS',
  WSH: 'WAS',
};
const team = (value: string) => TEAM_CODES[value.toUpperCase()] ?? value.toUpperCase();
const playerTeam = (row: Record<string, string>) => team(row.recent_team || row.team);
const playerStat = (row: Record<string, string>, current: string, legacy?: string) =>
  row[current] !== undefined ? row[current] : legacy ? row[legacy] : undefined;
const numberOrNull = (value: string | undefined) => {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const integerOrNull = (value: string | undefined) => {
  const n = numberOrNull(value);
  return n === null ? null : Math.round(n);
};

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((r) => r.some(Boolean))
    .map(
      (values) =>
        Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])) as Record<string, string>,
    );
}
async function download(url: string) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Down-Distance-Historical-Importer/1.0' },
  });
  if (!response.ok) throw new Error(`Unable to download ${url}: ${response.status}`);
  return response.text();
}
type Options = {
  seasons: number[];
  week?: number;
  playersOnly?: boolean;
  teamsOnly?: boolean;
  force?: boolean;
  dryRun?: boolean;
};
type Unmatched = {
  provider_player_id: string;
  provider_name: string;
  team: string;
  position: string;
  season: number;
  week: number;
  reason: string;
  possible_matches: string;
};

export async function importNflverseHistory(options: Options) {
  const seasons = new Set(options.seasons),
    gamesRaw = parseCsv(await download(process.env.NFLVERSE_GAMES_URL ?? GAMES_URL)).filter(
      (r) =>
        seasons.has(Number(r.season)) &&
        ['REG', 'POST'].includes(r.game_type) &&
        (!options.week || Number(r.week) === options.week),
    );
  const playerSources = process.env.NFLVERSE_PLAYER_STATS_URL
    ? [process.env.NFLVERSE_PLAYER_STATS_URL]
    : [...seasons].map(PLAYER_STATS_URL);
  const playersRaw = (await Promise.all(playerSources.map(download)))
    .flatMap(parseCsv)
    .filter(
      (r) =>
        seasons.has(Number(r.season)) &&
        ['REG', 'POST'].includes(r.season_type) &&
        (!options.week || Number(r.week) === options.week),
    );
  const gameLookup = new Map<string, Record<string, string>>();
  for (const game of gamesRaw) {
    gameLookup.set(`${game.season}:${game.week}:${team(game.home_team)}`, game);
    gameLookup.set(`${game.season}:${game.week}:${team(game.away_team)}`, game);
  }
  if (options.dryRun)
    return {
      games: gamesRaw.length,
      playerRows: playersRaw.length,
      teamRows: gamesRaw.length * 2,
      mappedPlayers: 0,
      unmatchedPlayers: 0,
      errors: 0,
      dryRun: true,
      strengthRecords: {},
    };
  const db = authDb();
  for (const code of new Set(gamesRaw.flatMap((g) => [team(g.home_team), team(g.away_team)])))
    await db`INSERT INTO provider_team_mappings(provider,provider_team_id,team_id) VALUES('NFLVERSE',${code},${code}) ON CONFLICT(provider,provider_team_id) DO UPDATE SET team_id=EXCLUDED.team_id,updated_at=now()`;
  for (const game of gamesRaw) {
    const kickoff =
      game.gameday && game.gametime ? `${game.gameday}T${game.gametime}:00-05:00` : null;
    await db`INSERT INTO historical_games(season,week,season_type,provider,provider_game_id,game_date,kickoff_at,home_team_id,away_team_id,home_score,away_score) VALUES(${Number(game.season)},${Number(game.week)},${game.game_type},'NFLVERSE',${game.game_id},${game.gameday},${kickoff},${team(game.home_team)},${team(game.away_team)},${integerOrNull(game.home_score)},${integerOrNull(game.away_score)}) ON CONFLICT(provider,provider_game_id) DO UPDATE SET week=EXCLUDED.week,season_type=EXCLUDED.season_type,game_date=EXCLUDED.game_date,kickoff_at=EXCLUDED.kickoff_at,home_team_id=EXCLUDED.home_team_id,away_team_id=EXCLUDED.away_team_id,home_score=EXCLUDED.home_score,away_score=EXCLUDED.away_score,updated_at=now()`;
  }
  const gameIds = await db<
    Array<{ id: string; providerGameId: string }>
  >`SELECT id,provider_game_id AS "providerGameId" FROM historical_games WHERE provider='NFLVERSE' AND season=ANY(${options.seasons})`;
  const ids = new Map(gameIds.map((g) => [g.providerGameId, g.id]));
  const existing = await db<
    Array<{ providerPlayerId: string; playerId: string }>
  >`SELECT provider_player_id AS "providerPlayerId",player_id AS "playerId" FROM provider_player_mappings WHERE provider='NFLVERSE'`;
  const mappedByProvider = new Map(existing.map((m) => [m.providerPlayerId, m.playerId])),
    unmatched = new Map<string, Unmatched>(),
    mappedPlayers = new Set<string>(),
    persistedMappings = new Set<string>();
  const candidates = NFL_LEAGUE_DATA.players;
  const mappedRows = [] as Array<{
    raw: Record<string, string>;
    playerId: string | null;
    gameId: string;
  }>;
  for (const raw of playersRaw) {
    const providerId = raw.player_id,
      name = raw.player_display_name || raw.player_name,
      teamId = playerTeam(raw),
      position = raw.position || raw.position_group;
    const game = gameLookup.get(`${raw.season}:${raw.week}:${teamId}`),
      gameId = game ? ids.get(game.game_id) : undefined;
    if (!game || !gameId) continue;
    let playerId = mappedByProvider.get(providerId) ?? null,
      confidence: 'EXACT_ID' | 'NAME_TEAM_POSITION' | 'NAME_POSITION' | null = playerId
        ? 'EXACT_ID'
        : null;
    if (!playerId) {
      const normalized = normalizePlayerName(name);
      const strict = candidates.filter(
        (p) =>
          normalizePlayerName(p.name) === normalized &&
          p.teamAbbr === teamId &&
          p.position === position,
      );
      const loose = candidates.filter(
        (p) => normalizePlayerName(p.name) === normalized && p.position === position,
      );
      if (strict.length === 1) {
        playerId = strict[0]!.id;
        confidence = 'NAME_TEAM_POSITION';
      } else if (strict.length === 0 && loose.length === 1) {
        playerId = loose[0]!.id;
        confidence = 'NAME_POSITION';
      } else {
        if (!unmatched.has(providerId))
          unmatched.set(providerId, {
            provider_player_id: providerId,
            provider_name: name,
            team: teamId,
            position,
            season: Number(raw.season),
            week: Number(raw.week),
            reason: strict.length > 1 || loose.length > 1 ? 'ambiguous match' : 'no match',
            possible_matches: (strict.length ? strict : loose)
              .map((p) => `${p.id}:${p.name}:${p.teamAbbr}`)
              .join('|'),
          });
      }
    }
    if (playerId && confidence) {
      mappedByProvider.set(providerId, playerId);
      mappedPlayers.add(providerId);
      if (!persistedMappings.has(providerId)) {
        persistedMappings.add(providerId);
        await db`INSERT INTO provider_player_mappings(provider,provider_player_id,player_id,provider_name,confidence) VALUES('NFLVERSE',${providerId},${playerId},${name},${confidence}) ON CONFLICT(provider,provider_player_id) DO UPDATE SET player_id=EXCLUDED.player_id,provider_name=EXCLUDED.provider_name,confidence=EXCLUDED.confidence,updated_at=now()`;
      }
    }
    mappedRows.push({ raw, playerId, gameId });
  }
  if (!options.playersOnly) {
    for (const game of gamesRaw) {
      const gameId = ids.get(game.game_id);
      if (!gameId) continue;
      for (const side of ['HOME', 'AWAY'] as const) {
        const teamId = team(side === 'HOME' ? game.home_team : game.away_team),
          opponent = team(side === 'HOME' ? game.away_team : game.home_team),
          teamRows = playersRaw.filter(
            (r) =>
              Number(r.season) === Number(game.season) &&
              Number(r.week) === Number(game.week) &&
              r.season_type === game.game_type &&
              playerTeam(r) === teamId,
          );
        const sum = (key: string, legacy?: string) =>
          teamRows.some((r) => playerStat(r, key, legacy) !== '')
            ? teamRows.reduce(
                (total, r) => total + (numberOrNull(playerStat(r, key, legacy)) ?? 0),
                0,
              )
            : null;
        await db`INSERT INTO historical_team_games(season,week,season_type,game_id,team_id,opponent_team_id,home_away,points,passing_attempts,passing_completions,passing_yards,passing_tds,interceptions,rushing_attempts,rushing_yards,rushing_tds,targets,receptions,receiving_yards,sacks_allowed,turnovers) VALUES(${Number(game.season)},${Number(game.week)},${game.game_type},${gameId},${teamId},${opponent},${side},${integerOrNull(side === 'HOME' ? game.home_score : game.away_score)},${sum('attempts')},${sum('completions')},${sum('passing_yards')},${sum('passing_tds')},${sum('passing_interceptions', 'interceptions')},${sum('carries')},${sum('rushing_yards')},${sum('rushing_tds')},${sum('targets')},${sum('receptions')},${sum('receiving_yards')},${sum('sacks_suffered', 'sacks')},${sum('sack_fumbles_lost')}) ON CONFLICT(game_id,team_id) DO UPDATE SET points=EXCLUDED.points,passing_attempts=EXCLUDED.passing_attempts,passing_completions=EXCLUDED.passing_completions,passing_yards=EXCLUDED.passing_yards,passing_tds=EXCLUDED.passing_tds,interceptions=EXCLUDED.interceptions,rushing_attempts=EXCLUDED.rushing_attempts,rushing_yards=EXCLUDED.rushing_yards,rushing_tds=EXCLUDED.rushing_tds,targets=EXCLUDED.targets,receptions=EXCLUDED.receptions,receiving_yards=EXCLUDED.receiving_yards,sacks_allowed=EXCLUDED.sacks_allowed,turnovers=EXCLUDED.turnovers,updated_at=now()`;
      }
    }
  }
  if (!options.teamsOnly) {
    for (const { raw, playerId, gameId } of mappedRows) {
      const game = gameLookup.get(`${raw.season}:${raw.week}:${playerTeam(raw)}`)!;
      const teamId = playerTeam(raw),
        opponent = team(teamId === team(game.home_team) ? game.away_team : game.home_team),
        homeAway = teamId === team(game.home_team) ? 'HOME' : 'AWAY',
        name = raw.player_display_name || raw.player_name;
      const rushingFumbles = numberOrNull(raw.rushing_fumbles),
        receivingFumbles = numberOrNull(raw.receiving_fumbles),
        rushingLost = numberOrNull(raw.rushing_fumbles_lost),
        receivingLost = numberOrNull(raw.receiving_fumbles_lost);
      const fumbles =
          rushingFumbles === null && receivingFumbles === null
            ? null
            : (rushingFumbles ?? 0) + (receivingFumbles ?? 0),
        fumblesLost =
          rushingLost === null && receivingLost === null
            ? null
            : (rushingLost ?? 0) + (receivingLost ?? 0);
      await db`INSERT INTO historical_player_games(season,week,season_type,game_id,player_id,provider,provider_player_id,provider_player_name,team_id,opponent_team_id,home_away,position,passing_attempts,passing_completions,passing_yards,passing_tds,interceptions,sacks_taken,carries,rushing_yards,rushing_tds,targets,receptions,receiving_yards,receiving_tds,fumbles,fumbles_lost,fantasy_points) VALUES(${Number(raw.season)},${Number(raw.week)},${raw.season_type},${gameId},${playerId},'NFLVERSE',${raw.player_id},${name},${teamId},${opponent},${homeAway},${raw.position || raw.position_group},${integerOrNull(raw.attempts)},${integerOrNull(raw.completions)},${numberOrNull(raw.passing_yards)},${integerOrNull(raw.passing_tds)},${integerOrNull(playerStat(raw, 'passing_interceptions', 'interceptions'))},${numberOrNull(playerStat(raw, 'sacks_suffered', 'sacks'))},${integerOrNull(raw.carries)},${numberOrNull(raw.rushing_yards)},${integerOrNull(raw.rushing_tds)},${integerOrNull(raw.targets)},${integerOrNull(raw.receptions)},${numberOrNull(raw.receiving_yards)},${integerOrNull(raw.receiving_tds)},${fumbles},${fumblesLost},${numberOrNull(raw.fantasy_points)}) ON CONFLICT(season,week,season_type,provider,provider_player_id,game_id) DO UPDATE SET player_id=EXCLUDED.player_id,provider_player_name=EXCLUDED.provider_player_name,team_id=EXCLUDED.team_id,opponent_team_id=EXCLUDED.opponent_team_id,home_away=EXCLUDED.home_away,position=EXCLUDED.position,passing_attempts=EXCLUDED.passing_attempts,passing_completions=EXCLUDED.passing_completions,passing_yards=EXCLUDED.passing_yards,passing_tds=EXCLUDED.passing_tds,interceptions=EXCLUDED.interceptions,sacks_taken=EXCLUDED.sacks_taken,carries=EXCLUDED.carries,rushing_yards=EXCLUDED.rushing_yards,rushing_tds=EXCLUDED.rushing_tds,targets=EXCLUDED.targets,receptions=EXCLUDED.receptions,receiving_yards=EXCLUDED.receiving_yards,receiving_tds=EXCLUDED.receiving_tds,fumbles=EXCLUDED.fumbles,fumbles_lost=EXCLUDED.fumbles_lost,fantasy_points=EXCLUDED.fantasy_points,updated_at=now()`;
    }
  }
  await mkdir(resolve(process.cwd(), 'reports'), { recursive: true });
  const header =
      'provider_player_id,provider_name,team,position,season,week,reason,possible_matches\n',
    escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  await writeFile(
    resolve(process.cwd(), 'reports', 'unmatched-nflverse-players.csv'),
    header + [...unmatched.values()].map((r) => Object.values(r).map(escape).join(',')).join('\n'),
  );
  const strengthRecords = options.playersOnly
    ? {}
    : await calculateTeamSeasonStrengths(options.seasons);
  return {
    games: gamesRaw.length,
    playerRows: mappedRows.length,
    teamRows: options.playersOnly ? 0 : gamesRaw.length * 2,
    mappedPlayers: mappedPlayers.size,
    unmatchedPlayers: unmatched.size,
    errors: 0,
    dryRun: false,
    strengthRecords,
  };
}
