import type { UnifiedPlayerStats } from '@/server/data/nfl-data';
import { normalizePlayerName } from '@/server/ingest/normalize';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

const PFR_CACHE_FILES = {
  passing: resolve(process.cwd(), 'data-cache', 'pfr-passing-2025.html'),
  rushing: resolve(process.cwd(), 'data-cache', 'pfr-rushing-2025.html'),
  receiving: resolve(process.cwd(), 'data-cache', 'pfr-receiving-2025.html'),
  defense: resolve(process.cwd(), 'data-cache', 'pfr-defense-2025.html'),
} as const;

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

const normalizeSourceViewHtml = (value: string) => {
  let normalized = value.replace(/\r\n/g, '\n');

  // Handle source-view cache files where rows are escaped in the page body.
  if (!/<tr[\s>]/i.test(normalized) && /&lt;tr[\s&gt;]/i.test(normalized)) {
    normalized = decodeEntities(normalized);
  }

  // If encoded markup still remains after one pass, decode again.
  if (/&lt;(?:table|thead|tbody|tr|td|th)\b/i.test(normalized)) {
    normalized = decodeEntities(normalized);
  }

  return normalized;
};

const loadCachedPfrHtml = async (filePath: string): Promise<string> => {
  const fileContent = await readFile(filePath, 'utf8');
  const decoded = decodeEntities(fileContent);
  return normalizeSourceViewHtml(decoded);
};

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
  GBS: 'GB',
  GB: 'GB',
  HOU: 'HOU',
  IND: 'IND',
  JAX: 'JAX',
  JAC: 'JAX',
  KAN: 'KC',
  KC: 'KC',
  LAC: 'LAC',
  LAR: 'LAR',
  LVR: 'LV',
  LVA: 'LV',
  LV: 'LV',
  MIA: 'MIA',
  MIN: 'MIN',
  NOR: 'NO',
  NO: 'NO',
  NWE: 'NE',
  NE: 'NE',
  NYG: 'NYG',
  NYJ: 'NYJ',
  PHI: 'PHI',
  PIT: 'PIT',
  SEA: 'SEA',
  SFO: 'SF',
  SF: 'SF',
  TAM: 'TB',
  TB: 'TB',
  TEN: 'TEN',
  WAS: 'WAS',
  WSH: 'WAS',
};

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

const toNumber = (value: string) => {
  const normalized = value.replace(/,/g, '').replace(/%$/, '').trim();
  if (!normalized) return undefined;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
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

const normalizeTeamAbbr = (teamAbbr: string) => PFR_TO_NFL_TEAM_ABBR[teamAbbr] ?? teamAbbr;

const parsePfrStatRows = (
  html: string,
  mappings: Array<[dataStat: string, outputStat: keyof UnifiedPlayerStats]>,
): TeamPlayerStatsRecord[] => {
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  const records: TeamPlayerStatsRecord[] = [];

  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1] ?? '';
    const row = extractDataStatCells(rowHtml);

    const playerName = row.get('name_display');
    const rawTeamAbbr = row.get('team_name_abbr')?.toUpperCase();
    const position = row.get('pos');

    if (!playerName || !rawTeamAbbr || !position || playerName === 'League Average') {
      continue;
    }

    const stats: UnifiedPlayerStats = {};

    for (const [dataStat, outputStat] of mappings) {
      const numericValue = toNumber(row.get(dataStat) ?? '');
      if (numericValue !== undefined) {
        stats[outputStat] = numericValue;
      }
    }

    if (!hasNonEmptyStats(stats)) continue;

    records.push({
      playerName,
      teamAbbr: normalizeTeamAbbr(rawTeamAbbr),
      position,
      stats,
    });
  }

  return records;
};

const parsePfrPassing = (html: string) => {
  const records = parsePfrStatRows(html, [
    ['pass_cmp_pct', 'completionPct'],
    ['pass_yds', 'passingYards'],
    ['pass_td', 'passingTD'],
    ['pass_int', 'interceptions'],
  ]);
  console.log(`[pfr:passing] parsed players: ${records.length}`);
  return records;
};

const parsePfrRushing = (html: string) => {
  const records = parsePfrStatRows(html, [
    ['rush_yds', 'rushYards'],
    ['rush_td', 'rushTD'],
    ['rush_yds_per_att', 'yardsPerCarry'],
  ]);
  console.log(`[pfr:rushing] parsed players: ${records.length}`);
  return records;
};

const parsePfrReceiving = (html: string) => {
  const records = parsePfrStatRows(html, [
    ['rec', 'receptions'],
    ['rec_yds', 'recYards'],
    ['rec_td', 'recTD'],
    ['rec_yds_per_rec', 'yardsPerCatch'],
  ]);
  console.log(`[pfr:receiving] parsed players: ${records.length}`);
  return records;
};

export const fetchPfrDefenseStats = async (): Promise<TeamPlayerStatsRecord[]> => {
  const html = await loadCachedPfrHtml(PFR_CACHE_FILES.defense);

  const records = parsePfrStatRows(html, [
    ['tackles_combined', 'tackles'],
    ['sacks', 'sacks'],
    ['def_int', 'interceptionsDef'],
    ['def_batted_passes', 'passDeflections'],
    ['pressures', 'pressures'],
    ['qb_hurry', 'qbHurries'],
    ['qb_knockdown', 'qbHits'],
    ['tackles_missed', 'missedTackles'],
    ['tackles_missed_pct', 'missedTacklesPct'],
  ]);

  console.log(`[pfr:defense] parsed players: ${records.length}`);
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

  const [passingHtml, rushingHtml, receivingHtml] = await Promise.all([
    loadCachedPfrHtml(PFR_CACHE_FILES.passing),
    loadCachedPfrHtml(PFR_CACHE_FILES.rushing),
    loadCachedPfrHtml(PFR_CACHE_FILES.receiving),
  ]);

  const offenseStats = [
    ...parsePfrPassing(passingHtml),
    ...parsePfrRushing(rushingHtml),
    ...parsePfrReceiving(receivingHtml),
  ];

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
