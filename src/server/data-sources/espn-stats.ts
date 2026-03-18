import type { UnifiedPlayerStats } from '@/server/data/nfl-data';
import { normalizePlayerName } from '@/server/ingest/normalize';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export type TeamPlayerStatsRecord = {
  playerId?: string;
  playerName: string;
  teamAbbr?: string;
  position?: string;
  stats: UnifiedPlayerStats;
};

type TeamRosterPlayer = {
  id: string;
  name: string;
  teamAbbr?: string;
  position?: string;
};

const ESPN_STATS_URLS = {
  passing: 'https://www.espn.com/nfl/stats/player/_/table/passing/sort/passingYards/dir/desc',
  rushing:
    'https://www.espn.com/nfl/stats/player/_/stat/rushing/table/rushing/sort/rushingYardsPerGame/dir/desc',
  receiving:
    'https://www.espn.com/nfl/stats/player/_/stat/receiving/table/receiving/sort/receivingYardsPerGame/dir/desc',
} as const;

type Category = keyof typeof ESPN_STATS_URLS;

const decodeEntities = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const PFR_TO_NFL_TEAM_ABBR: Record<string, string> = {
  ARI: 'ARI',
  ATL: 'ATL',
  BAL: 'BAL',
  BUF: 'BUF',
  CAR: 'CAR',
  CHI: 'CHI',
  CIN: 'CIN',
  CLE: 'CLE',
  DAL: 'DAL',
  DEN: 'DEN',
  DET: 'DET',
  GNB: 'GB',
  HOU: 'HOU',
  IND: 'IND',
  JAX: 'JAX',
  KAN: 'KC',
  LAC: 'LAC',
  LAR: 'LAR',
  LVR: 'LV',
  MIA: 'MIA',
  MIN: 'MIN',
  NOR: 'NO',
  NWE: 'NE',
  NYG: 'NYG',
  NYJ: 'NYJ',
  PHI: 'PHI',
  PIT: 'PIT',
  SEA: 'SEA',
  SFO: 'SF',
  TAM: 'TB',
  TEN: 'TEN',
  WAS: 'WSH',
};

const PFR_DEFENSE_URL = 'https://www.pro-football-reference.com/years/2025/defense_advanced.htm';
const PFR_DEFENSE_CACHE_FILE = resolve(process.cwd(), 'data-cache', 'pfr-defense-2025.html');
// Manual cache refresh if desired:
// curl -L "https://www.pro-football-reference.com/years/2025/defense_advanced.htm" -o data-cache/pfr-defense-2025.html

const stripTags = (value: string): string =>
  decodeEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeComparableName = (value: string) =>
  normalizePlayerName(value)
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const hasNonEmptyStats = (stats: UnifiedPlayerStats) => Object.keys(stats).length > 0;

const fetchHtml = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; nfl-manager-sync/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
};

const extractRows = (html: string): string[][] =>
  [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((rowMatch) =>
    [...(rowMatch[1] ?? '').matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
      stripTags(cellMatch[1] ?? ''),
    ),
  );

const parseNameRows = (rows: string[][]) => {
  return rows
    .filter(
      (cells) =>
        cells.length === 2 &&
        /^\d+$/.test(cells[0] ?? '') &&
        / [A-Z]{2,3}(?:\/[A-Z]{2,3})?$/.test(cells[1] ?? ''),
    )
    .map((cells) => {
      const raw = cells[1];
      const match = raw.match(/^(.*)\s+([A-Z]{2,3}(?:\/[A-Z]{2,3})?)$/);
      if (!match) {
        return null;
      }

      return {
        playerName: match[1].trim(),
        teamAbbr: match[2].trim().split('/')[0],
      };
    })
    .filter((entry): entry is { playerName: string; teamAbbr: string } => Boolean(entry));
};

const isCategoryHeaderRow = (cells: string[], category: Category) => {
  if (cells.length < 5 || cells[0] !== 'POS') return false;

  const upper = cells.map((cell) => cell.trim().toUpperCase());

  switch (category) {
    case 'passing':
      return upper.includes('CMP%') && upper.includes('ATT') && upper.includes('INT');

    case 'rushing':
      return (
        upper.includes('ATT') &&
        upper.includes('YDS') &&
        upper.includes('AVG') &&
        !upper.includes('CMP%')
      );

    case 'receiving':
      return (
        upper.includes('REC') &&
        upper.includes('TGTS') &&
        upper.includes('YDS') &&
        upper.includes('AVG')
      );

    default:
      return false;
  }
};

const isStatDataRow = (cells: string[], expectedLength: number) =>
  cells.length === expectedLength &&
  /^[A-Z]{1,6}$/.test(cells[0] ?? '') &&
  /^\d+$/.test(cells[1] ?? '');

const toNumber = (value: string) => {
  const normalized = value.replace(/,/g, '').replace(/%$/, '').trim();
  if (!normalized) return undefined;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const mapStatsFromHeaders = (
  category: Category,
  headers: string[],
  values: string[],
): UnifiedPlayerStats => {
  const stats: UnifiedPlayerStats = {};
  const headerIndex = new Map(headers.map((header, index) => [header.trim().toUpperCase(), index]));

  const get = (name: string) => {
    const index = headerIndex.get(name);
    if (index === undefined) return undefined;
    return toNumber(values[index] ?? '');
  };

  if (category === 'passing') {
    const completionPct = get('CMP%');
    const passingYards = get('YDS');
    const passingTD = get('TD');
    const interceptions = get('INT');

    if (completionPct !== undefined) stats.completionPct = completionPct;
    if (passingYards !== undefined) stats.passingYards = passingYards;
    if (passingTD !== undefined) stats.passingTD = passingTD;
    if (interceptions !== undefined) stats.interceptions = interceptions;
  }

  if (category === 'rushing') {
    const rushYards = get('YDS');
    const rushTD = get('TD');
    const yardsPerCarry = get('AVG');

    if (rushYards !== undefined) stats.rushYards = rushYards;
    if (rushTD !== undefined) stats.rushTD = rushTD;
    if (yardsPerCarry !== undefined) stats.yardsPerCarry = yardsPerCarry;
  }

  if (category === 'receiving') {
    const receptions = get('REC');
    const recYards = get('YDS');
    const recTD = get('TD');
    const yardsPerCatch = get('AVG');

    if (receptions !== undefined) stats.receptions = receptions;
    if (recYards !== undefined) stats.recYards = recYards;
    if (recTD !== undefined) stats.recTD = recTD;
    if (yardsPerCatch !== undefined) stats.yardsPerCatch = yardsPerCatch;
  }

  return stats;
};

const extractDataStatCells = (rowHtml: string) => {
  const cells = new Map<string, string>();
  const cellMatches = rowHtml.matchAll(
    /<(?:td|th)[^>]*data-stat="([^"]+)"[^>]*>([\s\S]*?)<\/(?:td|th)>/gi,
  );

  for (const match of cellMatches) {
    const key = match[1]?.trim();
    if (!key) continue;
    cells.set(key, stripTags(match[2] ?? ''));
  }

  return cells;
};

export const fetchPfrDefenseStats = async (): Promise<TeamPlayerStatsRecord[]> => {
  const parsePfrDefenseHtml = (html: string) => {
    const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    const records: TeamPlayerStatsRecord[] = [];

    for (const rowMatch of rowMatches) {
      const rowHtml = rowMatch[1] ?? '';
      const row = extractDataStatCells(rowHtml);
      const playerName = row.get('name_display');
      const teamNameAbbr = row.get('team_name_abbr')?.toUpperCase();
      const position = row.get('pos');

      if (!playerName || !teamNameAbbr || !position) continue;

      const stats: UnifiedPlayerStats = {};

      const tackles = toNumber(row.get('tackles_combined') ?? '');
      const sacks = toNumber(row.get('sacks') ?? '');
      const interceptionsDef = toNumber(row.get('def_int') ?? '');
      const passDeflections = toNumber(row.get('def_batted_passes') ?? '');
      const pressures = toNumber(row.get('pressures') ?? '');
      const qbHurries = toNumber(row.get('qb_hurry') ?? '');
      const qbHits = toNumber(row.get('qb_knockdown') ?? '');
      const missedTackles = toNumber(row.get('tackles_missed') ?? '');
      const missedTacklesPct = toNumber(row.get('tackles_missed_pct') ?? '');

      if (tackles !== undefined) stats.tackles = tackles;
      if (sacks !== undefined) stats.sacks = sacks;
      if (interceptionsDef !== undefined) stats.interceptionsDef = interceptionsDef;
      if (passDeflections !== undefined) stats.passDeflections = passDeflections;
      if (pressures !== undefined) stats.pressures = pressures;
      if (qbHurries !== undefined) stats.qbHurries = qbHurries;
      if (qbHits !== undefined) stats.qbHits = qbHits;
      if (missedTackles !== undefined) stats.missedTackles = missedTackles;
      if (missedTacklesPct !== undefined) stats.missedTacklesPct = missedTacklesPct;

      if (!hasNonEmptyStats(stats)) continue;

      records.push({
        playerName,
        teamAbbr: PFR_TO_NFL_TEAM_ABBR[teamNameAbbr] ?? teamNameAbbr,
        position,
        stats,
      });
    }

    console.log(`[pfr:defense] parsed players: ${records.length}`);
    console.log(`[pfr:defense] sample: ${JSON.stringify(records.slice(0, 3))}`);

    return records;
  };

  try {
    const response = await fetch(PFR_DEFENSE_URL, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        referer: 'https://www.pro-football-reference.com/',
        'cache-control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const html = await response.text();
    console.log('[pfr:defense] fetched live html');

    await mkdir(dirname(PFR_DEFENSE_CACHE_FILE), { recursive: true });
    await writeFile(PFR_DEFENSE_CACHE_FILE, html, 'utf8');
    console.log('[pfr:defense] wrote cache file');

    return parsePfrDefenseHtml(html);
  } catch (error) {
    console.warn('[pfr:defense] live fetch failed, trying cache');

    try {
      const cachedHtml = await readFile(PFR_DEFENSE_CACHE_FILE, 'utf8');
      console.log('[pfr:defense] loaded cached html');
      return parsePfrDefenseHtml(cachedHtml);
    } catch {
      console.warn('[pfr:defense] no cache available');
      return [];
    }
  }
};

const parseCategoryPage = (html: string, category: Category) => {
  const rows = extractRows(html);
  const nameRows = parseNameRows(rows);

  const headerIndex = rows.findIndex((row) => isCategoryHeaderRow(row, category));
  if (headerIndex === -1) {
    console.log(`[sync:players:debug] ${category} header not found`);
    return [];
  }

  const statHeader = rows[headerIndex];
  const statRows: string[][] = [];

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const cells = rows[i];

    if (isStatDataRow(cells, statHeader.length)) {
      statRows.push(cells);
      continue;
    }

    if (statRows.length > 0) {
      break;
    }
  }

  console.log(
    `[sync:players:debug] ${category} nameRows=${nameRows.length} statRows=${statRows.length} header=${JSON.stringify(statHeader)}`,
  );

  const zippedCount = Math.min(nameRows.length, statRows.length);
  const records: TeamPlayerStatsRecord[] = [];

  for (let i = 0; i < zippedCount; i += 1) {
    const identity = nameRows[i];
    const statRow = statRows[i];
    const stats = mapStatsFromHeaders(category, statHeader, statRow);

    if (!hasNonEmptyStats(stats)) continue;

    records.push({
      playerName: identity.playerName,
      teamAbbr: identity.teamAbbr,
      position: statRow[0],
      stats,
    });
  }

  console.log(
    `[sync:players:debug] ${category} zipped=${zippedCount} usable=${records.length} sample=${JSON.stringify(records.slice(0, 3))}`,
  );

  return records;
};

const mergeRecords = (records: TeamPlayerStatsRecord[]) => {
  const merged = new Map<string, TeamPlayerStatsRecord>();

  for (const record of records) {
    const key = `${normalizeComparableName(record.playerName)}:${record.teamAbbr ?? ''}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...record,
        stats: { ...record.stats },
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      stats: {
        ...existing.stats,
        ...record.stats,
      },
    });
  }

  return Array.from(merged.values());
};

export const fetchTeamStats = async (
  teamId: string,
  rosterPlayers: TeamRosterPlayer[],
): Promise<TeamPlayerStatsRecord[]> => {
  const rosterNames = new Set(rosterPlayers.map((player) => normalizeComparableName(player.name)));
  const rosterAbbr = rosterPlayers[0]?.teamAbbr;

  const pages = await Promise.all(
    Object.entries(ESPN_STATS_URLS).map(async ([category, url]) => {
      try {
        const html = await fetchHtml(url);
        return { category: category as Category, html };
      } catch {
        return { category: category as Category, html: '' };
      }
    }),
  );

  const offenseStats = pages.flatMap(({ category, html }) => {
    if (!html) return [];
    return parseCategoryPage(html, category);
  });

  const defenseStats = await fetchPfrDefenseStats();
  const parsed = [...offenseStats, ...defenseStats];

  const filtered = parsed.filter((record) => {
    const normalizedName = normalizeComparableName(record.playerName);
    if (!rosterNames.has(normalizedName)) return false;
    if (rosterAbbr && record.teamAbbr && rosterAbbr !== record.teamAbbr) return false;
    return hasNonEmptyStats(record.stats);
  });

  const merged = mergeRecords(filtered);

  console.log(
    `[sync:players:debug] team=${teamId} parsed=${parsed.length} filtered=${filtered.length} merged=${merged.length}`,
  );

  return merged;
};
