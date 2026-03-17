import type { UnifiedPlayerStats } from '@/server/data/nfl-data';

export type TeamPlayerStatsRecord = {
  playerId: string;
  playerName?: string;
  stats: UnifiedPlayerStats;
};

type TeamRosterPlayer = {
  id: string;
  name: string;
};

type EspnStat = {
  name?: string;
  displayName?: string;
  abbreviation?: string;
  value?: number | string | null;
  displayValue?: string;
};

type EspnStatsCategory = {
  name?: string;
  displayName?: string;
  labels?: string[];
  names?: string[];
  stats?: Array<EspnStat | number | string | null>;
  statistics?: Array<EspnStat | number | string | null>;
};

type EspnAthleteStats = {
  athlete?: { id?: string };
  id?: string;
  fullName?: string;
  displayName?: string;
  athleteDisplayName?: string;
  stats?: EspnStat[];
  statistics?: EspnStat[];
  categories?: EspnStatsCategory[];
  splits?: { categories?: EspnStatsCategory[] };
};

const DEBUG_TEAM_LIMIT = 3;
const debugTeams = new Set<string>();

const shouldLogTeamDebug = (teamId: string) => {
  if (debugTeams.has(teamId)) return true;
  if (debugTeams.size >= DEBUG_TEAM_LIMIT) return false;
  debugTeams.add(teamId);
  return true;
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

const currentDate = new Date();
const CURRENT_SEASON =
  currentDate.getUTCMonth() >= 6 ? currentDate.getUTCFullYear() : currentDate.getUTCFullYear() - 1;

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

const normalizeCategoryStats = (category: EspnStatsCategory): EspnStat[] => {
  const values = category.stats ?? category.statistics ?? [];
  const labels = category.labels ?? category.names ?? [];

  return values
    .map((value, index) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as EspnStat;
      }

      const key = labels[index];
      if (!key) return null;
      return {
        name: key,
        abbreviation: key,
        value,
      } as EspnStat;
    })
    .filter((entry): entry is EspnStat => Boolean(entry));
};

const collectStats = (athlete: EspnAthleteStats): EspnStat[] => {
  const directStats = (athlete.stats ?? athlete.statistics ?? []).filter(
    (entry): entry is EspnStat =>
      Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)),
  );
  const categoryStats = (athlete.categories ?? []).flatMap(normalizeCategoryStats);
  const splitCategoryStats = (athlete.splits?.categories ?? []).flatMap(normalizeCategoryStats);
  return [...directStats, ...categoryStats, ...splitCategoryStats];
};

const hasNonEmptyStats = (stats: UnifiedPlayerStats) => Object.keys(stats).length > 0;

const mapAthleteStats = (athlete: EspnAthleteStats): TeamPlayerStatsRecord | null => {
  const playerId = athlete.athlete?.id ?? athlete.id;
  if (!playerId) return null;

  const stats: UnifiedPlayerStats = {};
  collectStats(athlete).forEach((stat) => {
    const statKey = stat.name ?? stat.abbreviation ?? stat.displayName;
    if (!statKey) return;
    setStatValue(stats, statKey, stat.value ?? stat.displayValue);
  });

  if (!hasNonEmptyStats(stats)) return null;

  return {
    playerId,
    playerName: athlete.fullName ?? athlete.displayName ?? athlete.athleteDisplayName,
    stats,
  };
};

const fetchAthleteStats = async (
  player: TeamRosterPlayer,
  teamId: string,
  debugLog = false,
): Promise<TeamPlayerStatsRecord | null> => {
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${player.id}/stats?region=us&lang=en&contentorigin=espn&season=${CURRENT_SEASON}`;
  if (debugLog) {
    console.log(`[sync:players:debug] team=${teamId} athlete=${player.name} stats url=${url}`);
  }

  const payload = await fetchJson<{
    athlete?: EspnAthleteStats;
    splits?: EspnAthleteStats['splits'];
  }>(url, debugLog ? `athlete:${player.id}` : undefined).catch(() => null);

  if (!payload) return null;

  if (debugLog) {
    console.log(
      `[sync:players:debug] team=${teamId} athlete=${player.name} payload keys=${Object.keys(payload).join(',')}`,
    );
  }

  return mapAthleteStats({
    athlete: { id: player.id },
    fullName: player.name,
    splits: payload.splits,
    ...(payload.athlete ?? {}),
  });
};

const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) => {
  const results: R[] = [];
  let index = 0;

  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
  return results;
};

const fetchJson = async <T>(url: string, debugLabel?: string): Promise<T> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (debugLabel) {
    console.log(`[sync:players:debug] fetch ${debugLabel} status=${response.status} url=${url}`);
  }
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  const json = (await response.json()) as T;
  if (debugLabel && json && typeof json === 'object') {
    console.log(
      `[sync:players:debug] fetch ${debugLabel} top-level keys=${Object.keys(json).join(',')}`,
    );
  }
  return json;
};

export const fetchTeamStats = async (
  teamId: string,
  rosterPlayers: TeamRosterPlayer[],
): Promise<TeamPlayerStatsRecord[]> => {
  const debugLog = shouldLogTeamDebug(teamId);
  const teamUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/statistics`;
  if (debugLog) {
    console.log(`[sync:players:debug] team=${teamId} team stats url=${teamUrl}`);
  }

  const payload = await fetchJson<{
    athletes?: EspnAthleteStats[];
    results?: { athletes?: EspnAthleteStats[] };
    categories?: Array<{ athletes?: EspnAthleteStats[] }>;
  }>(teamUrl, debugLog ? `team:${teamId}` : undefined).catch(() => null);

  const athleteStats = [
    ...(payload?.athletes ?? []),
    ...(payload?.results?.athletes ?? []),
    ...(payload?.categories ?? []).flatMap((category) => category.athletes ?? []),
  ];

  if (debugLog) {
    console.log(`[sync:players:debug] team=${teamId} raw team athlete rows=${athleteStats.length}`);
  }

  const mappedTeamStats = athleteStats
    .map((entry) => mapAthleteStats(entry))
    .filter((entry): entry is TeamPlayerStatsRecord => Boolean(entry));

  if (debugLog) {
    console.log(
      `[sync:players:debug] team=${teamId} mapped team athlete rows=${mappedTeamStats.length}`,
    );
    console.log(
      `[sync:players:debug] team=${teamId} mapped sample=${JSON.stringify(mappedTeamStats.slice(0, 2))}`,
    );
  }

  if (mappedTeamStats.length > 0) {
    return mappedTeamStats;
  }

  const fallbackStats = await runWithConcurrency(rosterPlayers, 10, (player) =>
    fetchAthleteStats(
      player,
      teamId,
      debugLog && ['Patrick Mahomes', 'Travis Kelce', 'Chris Jones'].includes(player.name),
    ),
  );
  if (debugLog) {
    console.log(
      `[sync:players:debug] team=${teamId} fallback athlete rows=${fallbackStats.filter(Boolean).length}`,
    );
  }
  return fallbackStats.filter((entry): entry is TeamPlayerStatsRecord => Boolean(entry));
};
