import type { UnifiedPlayerStats } from '@/server/data/nfl-data';
import { normalizePlayerName, normalizeTeamName } from '@/server/ingest/normalize';

export type TeamPlayerStatsRecord = {
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
  playerId?: string;
  playerName: string;
  normalizedName: string;
  teamAbbr?: string;
  teamName?: string;
  normalizedTeam: string;
  position?: string;
  stats: UnifiedPlayerStats;
};

export type LeagueCategoryStatsResult = {
  records: NormalizedPlayerStatRecord[];
  parsedRowsByCategory: Record<StatCategory, number>;
};

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

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
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

const hasNonEmptyStats = (stats: UnifiedPlayerStats) => Object.keys(stats).length > 0;

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
  } else if (
    ['completionpct', 'completionpercentage', 'cppct', 'cmppercent', 'qbrcmp', 'cmp'].includes(key)
  ) {
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
  } else if (['tfl', 'tacklesforloss'].includes(key)) {
    target.tfl = value;
  } else if (['qbhits', 'qbh'].includes(key)) {
    target.qbHits = value;
  } else if (['defensiveinterceptions', 'interceptionsdef', 'intdef', 'int'].includes(key)) {
    target.interceptionsDef = value;
  } else if (['passesdefended', 'passdeflections', 'pd'].includes(key)) {
    target.passDeflections = value;
  } else if (['forcedfumbles', 'ff'].includes(key)) {
    target.forcedFumbles = value;
  }
};

const fetchHtml = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
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
};

const collectRows = (node: unknown, rows: RawStatsRow[] = []): RawStatsRow[] => {
  if (!node) return rows;

  if (Array.isArray(node)) {
    node.forEach((entry) => collectRows(entry, rows));
    return rows;
  }

  if (typeof node !== 'object') return rows;

  const record = node as Record<string, unknown>;
  const hasAthlete = Boolean(record.athlete || record.player || record.competitor);
  const hasStats = Boolean(record.stats || record.statistics || record.statLine || record.columns);

  if (hasAthlete && hasStats) {
    rows.push(record as RawStatsRow);
  }

  Object.values(record).forEach((value) => collectRows(value, rows));
  return rows;
};

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
  }

  if (!label) return null;

  return {
    name: label,
    abbreviation: label,
    value: value as number | string | null,
  };
};

const getStatsEntries = (row: RawStatsRow, defaultColumns: string[]): RawStat[] => {
  const values = (row.stats ?? row.statistics) as unknown;
  const labels =
    row.labels ??
    row.names ??
    row.columns?.map((entry) => entry.name ?? entry.abbreviation ?? entry.displayName) ??
    defaultColumns;

  if (Array.isArray(values)) {
    return values
      .map((entry, index) => asRawStat(entry, labels?.[index]))
      .filter((entry): entry is RawStat => Boolean(entry));
  }

  if (values && typeof values === 'object') {
    return Object.entries(values).map(([key, value]) => ({ name: key, value }));
  }

  const line = row.statLine;
  if (line && typeof line === 'object') {
    return Object.entries(line).map(([key, value]) => ({ name: key, value }));
  }

  return [];
};

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

  const playerId =
    (athlete.id as string | undefined) ??
    (row.id as string | undefined) ??
    (athlete.uid as string | undefined)?.split(':').pop() ??
    undefined;

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
};

export const fetchTeamStats = async (
  teamId: string,
  teamAbbr: string,
  rosterPlayers: TeamRosterPlayer[],
  leagueStats?: LeagueCategoryStatsResult,
): Promise<TeamPlayerStatsRecord[]> => {
  const statsResult = leagueStats ?? (await fetchLeagueCategoryStats());
  const rosterByName = new Map(
    rosterPlayers.map((player) => [normalizeComparableName(player.name), player]),
  );

  const candidates = statsResult.records.filter(
    (entry) =>
      normalizeAbbr(entry.teamAbbr) === normalizeAbbr(teamAbbr) ||
      normalizeComparableTeam(entry.teamName ?? '') === normalizeComparableTeam(teamAbbr),
  );

  const out = new Map<string, TeamPlayerStatsRecord>();

  candidates.forEach((entry) => {
    const byId = entry.playerId
      ? rosterPlayers.find((player) => player.id === entry.playerId)
      : undefined;
    const byName = rosterByName.get(entry.normalizedName);
    const rosterPlayer = byId ?? byName;
    if (!rosterPlayer) return;

    const existing = out.get(rosterPlayer.id);
    out.set(rosterPlayer.id, {
      playerId: rosterPlayer.id,
      playerName: rosterPlayer.name,
      stats: {
        ...(existing?.stats ?? {}),
        ...entry.stats,
      },
    });
  });

  if (out.size === 0) {
    console.log(`[sync:players] team=${teamId} (${teamAbbr}) had no matching category stats rows`);
  }

  return Array.from(out.values());
};
