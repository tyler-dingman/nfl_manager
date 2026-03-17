import type { UnifiedPlayerStats } from '@/server/data/nfl-data';

export type TeamPlayerStatsRecord = {
  playerId: string;
  stats: UnifiedPlayerStats;
};

type EspnStat = {
  name?: string;
  displayName?: string;
  abbreviation?: string;
  value?: number | string | null;
  displayValue?: string;
};

type EspnAthleteStats = {
  athlete?: { id?: string };
  stats?: EspnStat[];
  statistics?: EspnStat[];
  categories?: Array<{ stats?: EspnStat[]; statistics?: EspnStat[] }>;
};

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

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

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
  } else if (['completionpct', 'completionpercentage', 'cppct', 'comp', 'cmp'].includes(key)) {
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
  } else if (['tacklesforloss', 'tfl'].includes(key)) {
    target.tfl = value;
  } else if (['qbhits', 'quarterbackhits'].includes(key)) {
    target.qbHits = value;
  } else if (['defensiveinterceptions', 'interceptionsdef', 'intdef'].includes(key)) {
    target.interceptionsDef = value;
  } else if (['passesdefended', 'passdeflections', 'pd'].includes(key)) {
    target.passDeflections = value;
  } else if (['forcedfumbles', 'ff'].includes(key)) {
    target.forcedFumbles = value;
  }
};

const collectStats = (athlete: EspnAthleteStats): EspnStat[] => {
  const directStats = athlete.stats ?? athlete.statistics ?? [];
  const categoryStats = (athlete.categories ?? []).flatMap(
    (category) => category.stats ?? category.statistics ?? [],
  );
  return [...directStats, ...categoryStats];
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
};

export const fetchTeamStats = async (teamId: string): Promise<TeamPlayerStatsRecord[]> => {
  const payload = await fetchJson<{
    athletes?: EspnAthleteStats[];
    results?: { athletes?: EspnAthleteStats[] };
    categories?: Array<{ athletes?: EspnAthleteStats[] }>;
  }>(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/statistics`);

  const athleteStats = [
    ...(payload.athletes ?? []),
    ...(payload.results?.athletes ?? []),
    ...(payload.categories ?? []).flatMap((category) => category.athletes ?? []),
  ];

  const byPlayerId = new Map<string, UnifiedPlayerStats>();

  athleteStats.forEach((entry) => {
    const playerId = entry.athlete?.id;
    if (!playerId) return;

    const stats = byPlayerId.get(playerId) ?? {};
    collectStats(entry).forEach((stat) => {
      const statKey = stat.name ?? stat.abbreviation ?? stat.displayName;
      if (!statKey) return;
      setStatValue(stats, statKey, stat.value ?? stat.displayValue);
    });

    byPlayerId.set(playerId, stats);
  });

  return Array.from(byPlayerId.entries()).map(([playerId, stats]) => ({
    playerId,
    stats,
  }));
};
