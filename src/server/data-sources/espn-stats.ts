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

const currentDate = new Date();
const CURRENT_SEASON =
  currentDate.getUTCMonth() >= 6 ? currentDate.getUTCFullYear() : currentDate.getUTCFullYear() - 1;

const CATEGORY_SORT: Record<StatCategory, string> = {
  passing: 'passingYards',
  rushing: 'rushingYards',
  receiving: 'receivingYards',
  defensive: 'totalTackles',
};

const CATEGORY_URLS: Record<StatCategory, (page: number) => string[]> = {
  passing: (page) => [
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?region=us&lang=en&contentorigin=espn&season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=passing&sort=${CATEGORY_SORT.passing}%3Adesc`,
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/leaders?region=us&lang=en&contentorigin=espn&season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=passing`,
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/statistics/player?season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=passing`,
  ],
  rushing: (page) => [
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?region=us&lang=en&contentorigin=espn&season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=rushing&sort=${CATEGORY_SORT.rushing}%3Adesc`,
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/leaders?region=us&lang=en&contentorigin=espn&season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=rushing`,
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/statistics/player?season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=rushing`,
  ],
  receiving: (page) => [
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?region=us&lang=en&contentorigin=espn&season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=receiving&sort=${CATEGORY_SORT.receiving}%3Adesc`,
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/leaders?region=us&lang=en&contentorigin=espn&season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=receiving`,
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/statistics/player?season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=receiving`,
  ],
  defensive: (page) => [
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?region=us&lang=en&contentorigin=espn&season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=defensive&sort=${CATEGORY_SORT.defensive}%3Adesc`,
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/leaders?region=us&lang=en&contentorigin=espn&season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=defensive`,
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/statistics/player?season=${CURRENT_SEASON}&seasontype=2&page=${page}&limit=200&category=defensive`,
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
    ['completionpct', 'completionpercentage', 'cppct', 'cmppercent', 'qbrcmp'].includes(key)
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
  } else if (['totaltackles', 'tackles', 'tk'].includes(key)) {
    target.tackles = value;
  } else if (['sacks', 'sck'].includes(key)) {
    target.sacks = value;
  } else if (['defensiveinterceptions', 'interceptionsdef', 'intdef'].includes(key)) {
    target.interceptionsDef = value;
  } else if (['passesdefended', 'passdeflections', 'pd'].includes(key)) {
    target.passDeflections = value;
  } else if (['forcedfumbles', 'ff'].includes(key)) {
    target.forcedFumbles = value;
  }
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
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

const getStatsEntries = (row: RawStatsRow): RawStat[] => {
  const values = (row.stats ?? row.statistics) as unknown;
  const labels =
    row.labels ?? row.names ?? row.columns?.map((entry) => entry.name ?? entry.abbreviation);

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

const resolvePlayerMeta = (row: RawStatsRow) => {
  const athlete = (row.athlete ?? row.player ?? row.competitor ?? {}) as Record<string, unknown>;
  const team = (row.team ?? athlete.team ?? {}) as Record<string, unknown>;

  const playerName =
    (athlete.fullName as string | undefined) ??
    (athlete.displayName as string | undefined) ??
    (row.displayName as string | undefined) ??
    '';

  const teamAbbr =
    (team.abbreviation as string | undefined) ??
    (team.shortDisplayName as string | undefined) ??
    undefined;

  const teamName =
    (team.displayName as string | undefined) ?? (team.name as string | undefined) ?? teamAbbr;

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
    normalizedTeam: normalizeComparableTeam(teamName ?? ''),
    position: (athlete.position as Record<string, unknown> | undefined)?.abbreviation as
      | string
      | undefined,
  };
};

const parseCategoryRows = (payload: unknown): NormalizedPlayerStatRecord[] => {
  const rows = collectRows(payload, []);
  const parsed = rows
    .map((row): NormalizedPlayerStatRecord | null => {
      const meta = resolvePlayerMeta(row);
      if (!meta.playerName || !meta.normalizedName) return null;

      const stats: UnifiedPlayerStats = {};
      getStatsEntries(row).forEach((entry) => {
        const statKey = entry.name ?? entry.abbreviation ?? entry.displayName;
        if (!statKey) return;
        setStatValue(stats, statKey, entry.value ?? entry.displayValue);
      });

      if (!hasNonEmptyStats(stats)) return null;
      return { ...meta, stats };
    })
    .filter((entry): entry is NormalizedPlayerStatRecord => Boolean(entry));

  return parsed;
};

const mergeRecord = (
  target: Map<string, NormalizedPlayerStatRecord>,
  source: NormalizedPlayerStatRecord,
) => {
  const key = source.playerId
    ? `id:${source.playerId}`
    : `name:${source.normalizedName}:team:${source.normalizedTeam}`;

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
  const rows: NormalizedPlayerStatRecord[] = [];

  for (let page = 1; page <= 8; page += 1) {
    const urls = CATEGORY_URLS[category](page);
    let parsedPageRows: NormalizedPlayerStatRecord[] = [];

    for (const url of urls) {
      try {
        const payload = await fetchJson<unknown>(url);
        parsedPageRows = parseCategoryRows(payload);
        if (parsedPageRows.length > 0) break;
      } catch {
        // Try next public endpoint variant for this category/page.
      }
    }

    if (parsedPageRows.length === 0) {
      break;
    }

    rows.push(...parsedPageRows);
  }

  return rows;
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
    console.log(`[sync:players] ESPN ${category} rows parsed=${rows.length}`);
  }

  console.log(`[sync:players] ESPN merged player stat records=${mergedRecords.size}`);

  return {
    records: Array.from(mergedRecords.values()),
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
