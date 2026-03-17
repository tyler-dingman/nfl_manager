import type { UnifiedPlayerStats } from '@/server/data/nfl-data';
import { normalizePlayerName, normalizeTeamName } from '@/server/ingest/normalize';
import { TEAM_ALIAS_TO_ABBR } from '@/server/ingest/teams';

export type TeamPlayerStatsRecord = {
<<<<<<< HEAD
  playerId: string;
  playerName?: string;
  stats: UnifiedPlayerStats;
};

export type TeamRosterPlayer = {
  id: string;
  name: string;
};

type StatCategory = 'passing' | 'rushing' | 'receiving' | 'defensive';

type RawStat = {
  name?: string;
  displayName?: string;
  abbreviation?: string;
  value?: number | string | null;
  displayValue?: string;
};

type RawStatsRow = {
  id?: string;
  uid?: string;
  displayName?: string;
  athlete?: Record<string, unknown>;
  player?: Record<string, unknown>;
  competitor?: Record<string, unknown>;
  team?: Record<string, unknown>;
  statistics?: unknown;
  stats?: unknown;
  labels?: string[];
  names?: string[];
  columns?: Array<{ name?: string; displayName?: string; abbreviation?: string }>;
  statLine?: unknown;
  [key: string]: unknown;
};

export type NormalizedPlayerStatRecord = {
=======
>>>>>>> 6d9e9e6 (updated json)
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

<<<<<<< HEAD
const CATEGORY_PAGE_URLS: Record<StatCategory, string[]> = {
  passing: [
    'https://www.espn.com/nfl/stats/player/_/table/passing/sort/passingYards/dir/desc',
    'https://www.espn.com/nfl/stats/player/_/view/offense/stat/passing',
  ],
  rushing: [
    'https://www.espn.com/nfl/stats/player/_/table/rushing/sort/rushingYards/dir/desc',
    'https://www.espn.com/nfl/stats/player/_/view/offense/stat/rushing',
  ],
  receiving: [
    'https://www.espn.com/nfl/stats/player/_/table/receiving/sort/receivingYards/dir/desc',
    'https://www.espn.com/nfl/stats/player/_/view/offense/stat/receiving',
  ],
  defensive: [
    'https://www.espn.com/nfl/stats/player/_/table/defensive/sort/totalTackles/dir/desc',
    'https://www.espn.com/nfl/stats/player/_/view/defense/stat/defensive',
  ],
};

const normalizeComparableName = (value: string) => normalizePlayerName(value);

const normalizeComparableTeam = (value: string) => normalizeTeamName(value);

const normalizeAbbr = (value: string | undefined) => (value ?? '').trim().toUpperCase();
=======
const ESPN_STATS_URLS = [
  'https://www.espn.com/nfl/stats/player/_/table/passing/sort/passingYards/dir/desc',
  'https://www.espn.com/nfl/stats/player/_/table/rushing/sort/rushingYards/dir/desc',
  'https://www.espn.com/nfl/stats/player/_/table/receiving/sort/receivingYards/dir/desc',
  'https://www.espn.com/nfl/stats/player/_/table/defensive/sort/totalTackles/dir/desc',
];

const stripTags = (value: string): string =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const decodeEntities = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
>>>>>>> 6d9e9e6 (updated json)

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const normalizeComparableName = (value: string) =>
  normalizePlayerName(value)
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/%$/, '');
    if (!normalized) return undefined;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const setStatValue = (target: UnifiedPlayerStats, rawKey: string, rawValue: unknown) => {
  const key = normalizeKey(rawKey);
  const value = toNumber(rawValue);
  if (value === undefined) return;

  if (['passingyards', 'passyds', 'passyards', 'ydspass'].includes(key)) {
    target.passingYards = value;
  } else if (['passingtouchdowns', 'passingtd', 'passtd'].includes(key)) {
    target.passingTD = value;
  } else if (['interceptions', 'passinterceptions', 'ints'].includes(key)) {
    target.interceptions = value;
<<<<<<< HEAD
  } else if (
    ['completionpct', 'completionpercentage', 'cppct', 'cmppercent', 'qbrcmp', 'cmp'].includes(key)
  ) {
=======
  } else if (['completionpct', 'completionpercentage', 'cmp', 'comp'].includes(key)) {
>>>>>>> 6d9e9e6 (updated json)
    target.completionPct = value;
  } else if (['rushingyards', 'rushyards', 'rushyds', 'ydsrush'].includes(key)) {
    target.rushYards = value;
  } else if (['rushingtouchdowns', 'rushtd'].includes(key)) {
    target.rushTD = value;
  } else if (['yardspercarry', 'ypc'].includes(key)) {
    target.yardsPerCarry = value;
  } else if (['receivingyards', 'recyards', 'recyds', 'ydsrec'].includes(key)) {
    target.recYards = value;
  } else if (['receptions', 'rec'].includes(key)) {
    target.receptions = value;
  } else if (['receivingtouchdowns', 'rectd'].includes(key)) {
    target.recTD = value;
  } else if (['yardspercatch', 'ypr'].includes(key)) {
    target.yardsPerCatch = value;
  } else if (['totaltackles', 'tackles', 'tk', 'tot'].includes(key)) {
    target.tackles = value;
  } else if (['sacks', 'sck'].includes(key)) {
    target.sacks = value;
<<<<<<< HEAD
  } else if (['tfl', 'tacklesforloss'].includes(key)) {
    target.tfl = value;
  } else if (['qbhits', 'qbh'].includes(key)) {
    target.qbHits = value;
  } else if (['defensiveinterceptions', 'interceptionsdef', 'intdef', 'int'].includes(key)) {
=======
  } else if (['tacklesforloss', 'tfl'].includes(key)) {
    target.tfl = value;
  } else if (['qbhits', 'quarterbackhits'].includes(key)) {
    target.qbHits = value;
  } else if (['defensiveinterceptions', 'interceptionsdef', 'intdef'].includes(key)) {
>>>>>>> 6d9e9e6 (updated json)
    target.interceptionsDef = value;
  } else if (['passesdefended', 'passdeflections', 'pd'].includes(key)) {
    target.passDeflections = value;
  } else if (['forcedfumbles', 'ff'].includes(key)) {
    target.forcedFumbles = value;
  }
};

<<<<<<< HEAD
const fetchHtml = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0',
=======
const hasNonEmptyStats = (stats: UnifiedPlayerStats) => Object.keys(stats).length > 0;

const fetchHtml = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; nfl-manager-sync/1.0)',
>>>>>>> 6d9e9e6 (updated json)
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
<<<<<<< HEAD
};

const findBalancedJsonObject = (source: string, objectStart: number): string | null => {
  if (source[objectStart] !== '{') return null;

  let depth = 0;
  let inString = false;

  for (let i = objectStart; i < source.length; i += 1) {
    const ch = source[i];

    if (ch === '"') {
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && source[j] === '\\'; j -= 1) backslashes += 1;
      if (backslashes % 2 === 0) inString = !inString;
    }

    if (inString) continue;

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(objectStart, i + 1);
      }
    }
  }

  return null;
};

const parseJsonCandidate = (candidate: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    if (!candidate.includes('\\"')) return null;
    try {
      const unescaped = candidate.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      return JSON.parse(unescaped) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
};

const extractEmbeddedStatisticsObject = (html: string): Record<string, unknown> | null => {
  const tokens = ['"statistics":{', '\\"statistics\\":{'];

  for (const token of tokens) {
    let searchIndex = 0;
    while (searchIndex < html.length) {
      const idx = html.indexOf(token, searchIndex);
      if (idx === -1) break;

      const objectStart = html.indexOf('{', idx + token.indexOf('{'));
      if (objectStart === -1) break;

      const jsonObject = findBalancedJsonObject(html, objectStart);
      if (jsonObject) {
        const parsed = parseJsonCandidate(jsonObject);
        if (parsed) return parsed;
      }

      searchIndex = idx + token.length;
    }
  }

  return null;
=======
>>>>>>> 6d9e9e6 (updated json)
};

const extractTableRows = (html: string) => {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  return rows.map((match) => match[1] ?? '');
};

<<<<<<< HEAD
const collectColumnNames = (node: unknown, out: string[] = []): string[] => {
  if (!node) return out;

  if (Array.isArray(node)) {
    node.forEach((entry) => collectColumnNames(entry, out));
    return out;
  }

  if (typeof node !== 'object') return out;

  const record = node as Record<string, unknown>;
  const name = record.name ?? record.displayName ?? record.abbreviation ?? record.shortDisplayName;
  if (typeof name === 'string') out.push(name);

  Object.values(record).forEach((value) => collectColumnNames(value, out));
  return out;
};

const asRawStat = (value: unknown, label?: string): RawStat | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as RawStat;
=======
const extractCells = (rowHtml: string) =>
  [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) =>
    decodeEntities(stripTags(match[1] ?? '')),
  );

const inferTeamAbbr = (rowText: string): string | undefined => {
  for (const [alias, abbr] of Object.entries(TEAM_ALIAS_TO_ABBR)) {
    if (rowText.toLowerCase().includes(alias)) {
      return abbr;
    }
>>>>>>> 6d9e9e6 (updated json)
  }
  return undefined;
};

<<<<<<< HEAD
const getStatsEntries = (row: RawStatsRow, defaultColumns: string[]): RawStat[] => {
  const values = (row.stats ?? row.statistics) as unknown;
  const labels =
    row.labels ??
    row.names ??
    row.columns?.map((entry) => entry.name ?? entry.abbreviation ?? entry.displayName) ??
    defaultColumns;
=======
const parsePassingRows = (html: string): TeamPlayerStatsRecord[] => {
  const records: TeamPlayerStatsRecord[] = [];
>>>>>>> 6d9e9e6 (updated json)

  for (const rowHtml of extractTableRows(html)) {
    const rowText = decodeEntities(stripTags(rowHtml));
    const cells = extractCells(rowHtml);

    const playerName =
      [...rowHtml.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
        .map((match) => decodeEntities(stripTags(match[1] ?? '')).trim())
        .find((text) => text.includes(' ')) ?? '';

    if (!playerName || cells.length < 6) continue;

    const stats: UnifiedPlayerStats = {};
    setStatValue(stats, 'passingYards', cells.find((c) => /^\d{3,5}$/.test(c)) ?? '');
    const tdCandidate = cells.find((c) => /^\d{1,2}$/.test(c));
    if (tdCandidate) setStatValue(stats, 'passingTD', tdCandidate);

    const pctCandidate = cells.find((c) => /^\d{1,2}\.\d$/.test(c));
    if (pctCandidate) setStatValue(stats, 'completionPct', pctCandidate);

    const teamAbbr = inferTeamAbbr(rowText);

    if (!hasNonEmptyStats(stats)) continue;

    records.push({
      playerName,
      teamAbbr,
      position: 'QB',
      stats,
    });
  }

  return records;
};

<<<<<<< HEAD
const splitTrailingTeamAbbr = (raw: string): { playerName: string; teamAbbr?: string } => {
  const match = raw.trim().match(/^(.*)\s+([A-Z]{2,4})$/);
  if (!match) return { playerName: raw.trim() };
  return {
    playerName: match[1].trim(),
    teamAbbr: match[2],
  };
};

const resolvePlayerMeta = (row: RawStatsRow) => {
  const athlete = (row.athlete ?? row.player ?? row.competitor ?? {}) as Record<string, unknown>;
  const team = (row.team ?? athlete.team ?? {}) as Record<string, unknown>;

  const displayName =
    (athlete.fullName as string | undefined) ??
    (athlete.displayName as string | undefined) ??
    (row.displayName as string | undefined) ??
    '';

  const extracted = splitTrailingTeamAbbr(displayName);
  const playerName = extracted.playerName;

  const teamAbbr =
    (team.abbreviation as string | undefined) ??
    (team.shortDisplayName as string | undefined) ??
    extracted.teamAbbr ??
    undefined;

  const teamName =
    (team.displayName as string | undefined) ??
    (team.name as string | undefined) ??
    teamAbbr ??
    undefined;
=======
const parseRushingRows = (html: string): TeamPlayerStatsRecord[] => {
  const records: TeamPlayerStatsRecord[] = [];

  for (const rowHtml of extractTableRows(html)) {
    const rowText = decodeEntities(stripTags(rowHtml));
    const cells = extractCells(rowHtml);

    const playerName =
      [...rowHtml.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
        .map((match) => decodeEntities(stripTags(match[1] ?? '')).trim())
        .find((text) => text.includes(' ')) ?? '';

    if (!playerName || cells.length < 6) continue;
>>>>>>> 6d9e9e6 (updated json)

    const stats: UnifiedPlayerStats = {};
    const yds = cells.find((c) => /^\d{2,4}$/.test(c));
    const ypc = cells.find((c) => /^\d\.\d$/.test(c));
    const td = cells.filter((c) => /^\d{1,2}$/.test(c)).at(-1);

<<<<<<< HEAD
  return {
    playerId,
    playerName,
    normalizedName: normalizeComparableName(playerName),
    teamAbbr,
    teamName,
    normalizedTeam: normalizeComparableTeam(teamName ?? teamAbbr ?? ''),
    position: (athlete.position as Record<string, unknown> | undefined)?.abbreviation as
      | string
      | undefined,
  };
};

const parseStatisticsRows = (
  statisticsObject: Record<string, unknown>,
): NormalizedPlayerStatRecord[] => {
  const rows = collectRows(statisticsObject, []);
  const columnNames = Array.from(new Set(collectColumnNames(statisticsObject, [])));

  return rows
    .map((row): NormalizedPlayerStatRecord | null => {
      const meta = resolvePlayerMeta(row);
      if (!meta.playerName || !meta.normalizedName) return null;

      const stats: UnifiedPlayerStats = {};
      getStatsEntries(row, columnNames).forEach((entry) => {
        const statKey = entry.name ?? entry.abbreviation ?? entry.displayName;
        if (!statKey) return;
        setStatValue(stats, statKey, entry.value ?? entry.displayValue);
      });

      if (!hasNonEmptyStats(stats)) return null;
      return { ...meta, stats };
    })
    .filter((entry): entry is NormalizedPlayerStatRecord => Boolean(entry));
};

const mergeRecord = (
  target: Map<string, NormalizedPlayerStatRecord>,
  source: NormalizedPlayerStatRecord,
) => {
  const key = source.playerId
    ? `id:${source.playerId}`
    : `name:${source.normalizedName}:team:${normalizeAbbr(source.teamAbbr)}`;

  const existing = target.get(key);
  if (!existing) {
    target.set(key, source);
    return;
  }

  target.set(key, {
    ...existing,
    ...source,
    stats: {
      ...existing.stats,
      ...source.stats,
    },
  });
};

const fetchCategoryRows = async (category: StatCategory): Promise<NormalizedPlayerStatRecord[]> => {
  for (const url of CATEGORY_PAGE_URLS[category]) {
    try {
      const html = await fetchHtml(url);
      const statisticsObject = extractEmbeddedStatisticsObject(html);
      if (!statisticsObject) continue;

      const rows = parseStatisticsRows(statisticsObject);
      if (rows.length > 0) return rows;
    } catch {
      // Try the next category page variant.
    }
  }

  return [];
};

const logSampleStats = (records: NormalizedPlayerStatRecord[]) => {
  const samplePlayers = ['Patrick Mahomes', 'Travis Kelce', 'Chris Jones'];

  samplePlayers.forEach((name) => {
    const normalized = normalizeComparableName(name);
    const sample = records.find((record) => record.normalizedName === normalized);
    console.log(
      `[sync:players] ESPN sample ${name}: ${sample ? JSON.stringify(sample.stats) : 'not found'}`,
    );
  });
};

export const fetchLeagueCategoryStats = async (): Promise<LeagueCategoryStatsResult> => {
  const categories: StatCategory[] = ['passing', 'rushing', 'receiving', 'defensive'];
  const mergedRecords = new Map<string, NormalizedPlayerStatRecord>();
  const parsedRowsByCategory: Record<StatCategory, number> = {
    passing: 0,
    rushing: 0,
    receiving: 0,
    defensive: 0,
  };

  for (const category of categories) {
    const rows = await fetchCategoryRows(category);
    parsedRowsByCategory[category] = rows.length;
    rows.forEach((row) => mergeRecord(mergedRecords, row));
    console.log(`[sync:players] ESPN ${category} rows extracted=${rows.length}`);
  }

  const records = Array.from(mergedRecords.values());
  console.log(`[sync:players] ESPN merged player stat records=${records.length}`);
  logSampleStats(records);

  return {
    records,
    parsedRowsByCategory,
  };
=======
    if (yds) setStatValue(stats, 'rushYards', yds);
    if (ypc) setStatValue(stats, 'yardsPerCarry', ypc);
    if (td) setStatValue(stats, 'rushTD', td);

    const teamAbbr = inferTeamAbbr(rowText);

    if (!hasNonEmptyStats(stats)) continue;

    records.push({
      playerName,
      teamAbbr,
      position: 'RB',
      stats,
    });
  }

  return records;
};

const parseReceivingRows = (html: string): TeamPlayerStatsRecord[] => {
  const records: TeamPlayerStatsRecord[] = [];

  for (const rowHtml of extractTableRows(html)) {
    const rowText = decodeEntities(stripTags(rowHtml));
    const cells = extractCells(rowHtml);

    const playerName =
      [...rowHtml.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
        .map((match) => decodeEntities(stripTags(match[1] ?? '')).trim())
        .find((text) => text.includes(' ')) ?? '';

    if (!playerName || cells.length < 6) continue;

    const stats: UnifiedPlayerStats = {};
    const receptions = cells.find((c) => /^\d{1,3}$/.test(c));
    const recYards = cells.find((c) => /^\d{2,4}$/.test(c));
    const ypr = cells.find((c) => /^\d{1,2}\.\d$/.test(c));
    const td = cells.filter((c) => /^\d{1,2}$/.test(c)).at(-1);

    if (receptions) setStatValue(stats, 'receptions', receptions);
    if (recYards) setStatValue(stats, 'recYards', recYards);
    if (ypr) setStatValue(stats, 'yardsPerCatch', ypr);
    if (td) setStatValue(stats, 'recTD', td);

    const teamAbbr = inferTeamAbbr(rowText);

    if (!hasNonEmptyStats(stats)) continue;

    records.push({
      playerName,
      teamAbbr,
      stats,
    });
  }

  return records;
};

const parseDefenseRows = (html: string): TeamPlayerStatsRecord[] => {
  const records: TeamPlayerStatsRecord[] = [];

  for (const rowHtml of extractTableRows(html)) {
    const rowText = decodeEntities(stripTags(rowHtml));
    const cells = extractCells(rowHtml);

    const playerName =
      [...rowHtml.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
        .map((match) => decodeEntities(stripTags(match[1] ?? '')).trim())
        .find((text) => text.includes(' ')) ?? '';

    if (!playerName || cells.length < 5) continue;

    const stats: UnifiedPlayerStats = {};
    const tackles = cells.find((c) => /^\d{1,3}$/.test(c));
    const sacks = cells.find((c) => /^\d{1,2}(\.\d)?$/.test(c));
    const ints = cells.filter((c) => /^\d{1,2}$/.test(c)).at(-1);

    if (tackles) setStatValue(stats, 'tackles', tackles);
    if (sacks) setStatValue(stats, 'sacks', sacks);
    if (ints) setStatValue(stats, 'interceptionsDef', ints);

    const teamAbbr = inferTeamAbbr(rowText);

    if (!hasNonEmptyStats(stats)) continue;

    records.push({
      playerName,
      teamAbbr,
      stats,
    });
  }

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
>>>>>>> 6d9e9e6 (updated json)
};

export const fetchTeamStats = async (
  teamId: string,
  rosterPlayers: TeamRosterPlayer[],
): Promise<TeamPlayerStatsRecord[]> => {
  const rosterNames = new Set(rosterPlayers.map((player) => normalizeComparableName(player.name)));
  const rosterAbbr = rosterPlayers[0]?.teamAbbr;

  const pages = await Promise.all(
    ESPN_STATS_URLS.map(async (url) => {
      try {
        const html = await fetchHtml(url);
        return { url, html };
      } catch {
        return { url, html: '' };
      }
    }),
  );

  const parsed = pages.flatMap(({ url, html }) => {
    if (!html) return [];
    if (url.includes('/table/passing/')) return parsePassingRows(html);
    if (url.includes('/table/rushing/')) return parseRushingRows(html);
    if (url.includes('/table/receiving/')) return parseReceivingRows(html);
    if (url.includes('/table/defensive/')) return parseDefenseRows(html);
    return [];
  });

  const filtered = parsed.filter((record) => {
    const normalizedName = normalizeComparableName(record.playerName);
    if (!rosterNames.has(normalizedName)) return false;
    if (rosterAbbr && record.teamAbbr && rosterAbbr !== record.teamAbbr) return false;
    return hasNonEmptyStats(record.stats);
  });

  return mergeRecords(filtered);
};

export const fetchLeagueCategoryStats = fetchTeamStats;
