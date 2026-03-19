import type { UnifiedPlayerStats } from '@/server/data/nfl-data';
import { normalizePlayerName } from '@/server/ingest/normalize';

const ESPN_TEAMS_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
const ESPN_SEARCH_URL = 'https://site.web.api.espn.com/apis/search/v2';
const ESPN_CORE_ATHLETE_BASE_URL =
  'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes';

type EspnTeam = {
  id: string;
  displayName: string;
  shortDisplayName?: string;
  abbreviation?: string;
};

type EspnAthleteImage = {
  href?: string;
  alt?: string;
};

type EspnRosterAthlete = {
  id: string;
  fullName: string;
  displayName?: string;
  jersey?: string;
  age?: number;
  displayHeight?: string;
  displayWeight?: string;
  weight?: number;
  position?: { abbreviation?: string; displayName?: string };
  headshot?: EspnAthleteImage;
  images?: EspnAthleteImage[];
};

export type TeamSourceRecord = {
  id: string;
  name: string;
  abbreviation: string;
};

export type PlayerSourceRecord = {
  id: string;
  teamId: string;
  name: string;
  position: string;
  age: number | null;
  height: string | null;
  weight: number | null;
  headshotUrl: string | null;
};

export type EspnExternalPlayerProfile = {
  id: string;
  name: string;
  position: string;
  age: number | null;
  height: string | null;
  weight: number | null;
  headshotUrl: string | null;
  stats: UnifiedPlayerStats;
};

type EspnSearchPlayerResult = {
  id?: string;
  uid?: string;
  displayName?: string;
  subtitle?: string;
  link?: {
    web?: string;
  };
  image?: {
    default?: string;
  };
};

type EspnAthleteSearchResponse = {
  results?: Array<{
    type?: string;
    contents?: EspnSearchPlayerResult[];
  }>;
};

type EspnCoreAthlete = {
  id?: string;
  displayName?: string;
  age?: number;
  displayHeight?: string;
  weight?: number;
  displayWeight?: string;
  position?: { abbreviation?: string; displayName?: string };
  headshot?: { href?: string };
  statistics?: { $ref?: string };
};

type EspnCoreAthleteStatsResponse = {
  splits?: {
    categories?: Array<{
      name?: string;
      stats?: Array<{
        name?: string;
        value?: number;
      }>;
    }>;
  };
};

const normalizeMatchPosition = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  if (['LT', 'RT', 'T', 'OT'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'G', 'OL', 'IOL', 'C'].includes(normalized)) return 'IOL';
  if (['LE', 'RE', 'DE', 'EDGE', 'ED', 'OLB'].includes(normalized)) return 'EDGE';
  if (['DT', 'NT', 'DL', 'IDL'].includes(normalized)) return 'DL';
  if (['MLB', 'ILB', 'LB', 'OLB', 'LOLB', 'ROLB'].includes(normalized)) return 'LB';
  if (['FS', 'SS', 'S'].includes(normalized)) return 'S';
  if (['HB', 'FB', 'RB'].includes(normalized)) return 'RB';
  return normalized;
};

const extractEspnAthleteId = (result: EspnSearchPlayerResult): string | null => {
  const uidMatch = result.uid?.match(/~a:(\d+)/);
  if (uidMatch?.[1]) {
    return uidMatch[1];
  }

  const webIdMatch = result.link?.web?.match(/\/id\/(\d+)\//);
  if (webIdMatch?.[1]) {
    return webIdMatch[1];
  }

  const rawId = result.id?.trim();
  if (rawId && /^\d+$/.test(rawId)) {
    return rawId;
  }

  return null;
};

const mapEspnStatCategoriesToUnifiedStats = (
  response: EspnCoreAthleteStatsResponse,
): UnifiedPlayerStats => {
  const stats: UnifiedPlayerStats = {};
  const categories = response.splits?.categories ?? [];
  const byCategory = new Map(
    categories.map((category) => [
      category.name ?? '',
      new Map(
        (category.stats ?? [])
          .filter((stat): stat is { name: string; value?: number } => Boolean(stat.name))
          .map((stat) => [stat.name, stat.value]),
      ),
    ]),
  );

  const passing = byCategory.get('passing');
  const rushing = byCategory.get('rushing');
  const receiving = byCategory.get('receiving');
  const defense = byCategory.get('defensive') ?? byCategory.get('defense');
  const interceptions = byCategory.get('defensiveInterceptions');

  if (passing?.get('passingYards') !== undefined) stats.passingYards = passing.get('passingYards');
  if (passing?.get('passingTouchdowns') !== undefined)
    stats.passingTD = passing.get('passingTouchdowns');
  if (passing?.get('interceptions') !== undefined)
    stats.interceptions = passing.get('interceptions');
  if (passing?.get('completionPct') !== undefined)
    stats.completionPct = passing.get('completionPct');

  if (rushing?.get('rushingYards') !== undefined) stats.rushYards = rushing.get('rushingYards');
  if (rushing?.get('rushingTouchdowns') !== undefined)
    stats.rushTD = rushing.get('rushingTouchdowns');

  if (receiving?.get('receivingYards') !== undefined)
    stats.recYards = receiving.get('receivingYards');
  if (receiving?.get('receptions') !== undefined) stats.receptions = receiving.get('receptions');
  if (receiving?.get('receivingTouchdowns') !== undefined)
    stats.recTD = receiving.get('receivingTouchdowns');

  if (defense?.get('soloTackles') !== undefined) stats.tackles = defense.get('soloTackles');
  if (defense?.get('sacks') !== undefined) stats.sacks = defense.get('sacks');
  if (defense?.get('tacklesForLoss') !== undefined) stats.tfl = defense.get('tacklesForLoss');
  if (defense?.get('QBHits') !== undefined) stats.qbHits = defense.get('QBHits');
  if (defense?.get('hurries') !== undefined) stats.qbHurries = defense.get('hurries');
  if (defense?.get('passesDefended') !== undefined)
    stats.passDeflections = defense.get('passesDefended');
  if (defense?.get('forcedFumbles') !== undefined)
    stats.forcedFumbles = defense.get('forcedFumbles');
  if (interceptions?.get('interceptions') !== undefined) {
    stats.interceptionsDef = interceptions.get('interceptions');
  }

  return stats;
};

const buildEspnHeadshotUrl = (playerId: string) =>
  `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`;

const resolveHeadshotUrl = (athlete: EspnRosterAthlete): string | null => {
  const fromHeadshot = athlete.headshot?.href?.trim();
  if (fromHeadshot) return fromHeadshot;

  const imageCandidate = athlete.images?.find((image) => image.href?.trim());
  if (imageCandidate?.href) return imageCandidate.href.trim();

  if (athlete.id) return buildEspnHeadshotUrl(athlete.id);
  return null;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
};

const fetchEspnAthleteDetail = async (playerId: string): Promise<EspnCoreAthlete> =>
  fetchJson<EspnCoreAthlete>(`${ESPN_CORE_ATHLETE_BASE_URL}/${playerId}?lang=en&region=us`);

const fetchEspnAthleteStats = async (statsRef?: string): Promise<UnifiedPlayerStats> => {
  if (!statsRef) return {};
  const statsUrl = statsRef.startsWith('http://')
    ? statsRef.replace('http://', 'https://')
    : statsRef;
  const payload = await fetchJson<EspnCoreAthleteStatsResponse>(statsUrl);
  return mapEspnStatCategoriesToUnifiedStats(payload);
};

export const fetchBestAvailableEspnPlayerProfile = async ({
  name,
  position,
  age,
}: {
  name: string;
  position?: string | null;
  age?: number | null;
}): Promise<EspnExternalPlayerProfile | null> => {
  const query = encodeURIComponent(name);
  const payload = await fetchJson<EspnAthleteSearchResponse>(`${ESPN_SEARCH_URL}?query=${query}`);
  const playerResults =
    payload.results?.find((result) => result.type === 'player')?.contents?.filter(Boolean) ?? [];
  if (playerResults.length === 0) {
    return null;
  }

  const normalizedName = normalizePlayerName(name);
  const normalizedPosition = position ? normalizeMatchPosition(position) : null;
  let bestCandidate: (EspnExternalPlayerProfile & { score: number }) | null = null;

  for (const result of playerResults.slice(0, 5)) {
    const id = extractEspnAthleteId(result);
    if (!id) continue;

    const detail = await fetchEspnAthleteDetail(id);
    const detailName = detail.displayName?.trim();
    if (!detailName || normalizePlayerName(detailName) !== normalizedName) {
      continue;
    }

    let score = 100;
    const detailPosition = detail.position?.abbreviation ?? detail.position?.displayName ?? 'UNK';
    if (normalizedPosition) {
      score += normalizeMatchPosition(detailPosition) === normalizedPosition ? 25 : -30;
    }
    if (typeof age === 'number' && typeof detail.age === 'number') {
      score -= Math.abs(age - detail.age) * 5;
    }

    const stats = await fetchEspnAthleteStats(detail.statistics?.$ref);
    const candidate = {
      id,
      name: detailName,
      position: detailPosition,
      age: detail.age ?? null,
      height: detail.displayHeight ?? null,
      weight:
        detail.weight ??
        (Number.parseInt(String(detail.displayWeight ?? '').replace(/[^0-9]/g, ''), 10) || null),
      headshotUrl:
        detail.headshot?.href?.trim() ?? result.image?.default?.trim() ?? buildEspnHeadshotUrl(id),
      stats,
      score,
    };

    if (!bestCandidate || candidate.score > bestCandidate.score) {
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) {
    return null;
  }

  const { score: _score, ...profile } = bestCandidate;
  return profile;
};

export const fetchTeams = async (): Promise<TeamSourceRecord[]> => {
  const payload = await fetchJson<{
    sports?: Array<{ leagues?: Array<{ teams?: Array<{ team?: EspnTeam }> }> }>;
  }>(ESPN_TEAMS_URL);
  const teams = payload.sports?.[0]?.leagues?.[0]?.teams ?? [];

  return teams
    .map((entry) => entry.team)
    .filter((team): team is EspnTeam => Boolean(team?.id && team.abbreviation && team.displayName))
    .map((team) => ({
      id: team.id,
      name: team.displayName,
      abbreviation: team.abbreviation ?? team.shortDisplayName ?? team.displayName.slice(0, 3),
    }));
};

export const fetchRoster = async (teamId: string): Promise<PlayerSourceRecord[]> => {
  const payload = await fetchJson<{ athletes?: Array<{ items?: EspnRosterAthlete[] }> }>(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`,
  );

  return (payload.athletes ?? []).flatMap((group) =>
    (group.items ?? [])
      .filter((athlete) => athlete.id && athlete.fullName)
      .map((athlete) => ({
        id: athlete.id,
        teamId,
        name: athlete.fullName,
        position: athlete.position?.abbreviation ?? athlete.position?.displayName ?? 'UNK',
        age: athlete.age ?? null,
        height: athlete.displayHeight ?? null,
        weight: athlete.weight ?? (Number.parseInt(athlete.displayWeight ?? '', 10) || null),
        headshotUrl: resolveHeadshotUrl(athlete),
      })),
  );
};
