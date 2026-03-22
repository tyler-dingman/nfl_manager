import https from 'node:https';

import type { UnifiedPlayerStats } from '@/server/data/nfl-data';
import { normalizePlayerName, normalizeTeamName } from '@/server/ingest/normalize';

const ESPN_DRAFT_BEST_AVAILABLE_URL = 'https://www.espn.com/nfl/draft/bestavailable';
const ESPN_SEARCH_URL = 'https://site.web.api.espn.com/apis/search/v2';
const ESPN_COLLEGE_ATHLETE_BASE_URL =
  'https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/athletes';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

type EspnDraftBoardPayload = {
  bestAvailable?: {
    athletes?: EspnDraftBoardAthlete[];
    pageCount?: number;
    pageIndex?: number;
    pageSize?: number;
  };
  positions?: Array<{ id?: string; name?: string; displayName?: string; abbreviation?: string }>;
};

type EspnDraftBoardAthlete = {
  id?: string;
  alternativeId?: string;
  displayName?: string;
  displayHeight?: string;
  displayWeight?: string;
  weight?: number;
  height?: number;
  link?: string;
  headshot?: { href?: string };
  attributes?: Array<{
    name?: string;
    displayName?: string;
    displayValue?: string;
    abbreviation?: string;
  }>;
  position?: { id?: string };
  team?: {
    shortDisplayName?: string;
    name?: string;
    location?: string;
    abbreviation?: string;
  };
};

type EspnSearchPlayerResult = {
  id?: string;
  uid?: string;
  displayName?: string;
  subtitle?: string;
  link?: { web?: string };
};

type EspnAthleteSearchResponse = {
  results?: Array<{
    type?: string;
    contents?: EspnSearchPlayerResult[];
  }>;
};

type EspnCollegeAthlete = {
  id?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  displayName?: string;
  age?: number;
  height?: number;
  displayHeight?: string;
  weight?: number;
  displayWeight?: string;
  birthPlace?: {
    city?: string;
    state?: string;
    country?: string;
  };
  headshot?: {
    href?: string;
    alt?: string;
  };
  position?: {
    abbreviation?: string;
    displayName?: string;
    name?: string;
  };
  links?: Array<{
    rel?: string[];
    href?: string;
  }>;
  experience?: {
    displayValue?: string;
    abbreviation?: string;
    years?: number;
  };
  statistics?: {
    $ref?: string;
  };
  statisticslog?: {
    $ref?: string;
  };
};

type EspnStatsLogResponse = {
  entries?: Array<{
    season?: {
      $ref?: string;
    };
    statistics?: Array<{
      type?: string;
      statistics?: {
        $ref?: string;
      };
    }>;
  }>;
};

type EspnAthleteStatsResponse = {
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

export type DraftBoardRankingRecord = {
  ranking: number | null;
  grade: string | null;
  name: string;
  normalizedName: string;
  school: string | null;
  position: string | null;
  headshotUrl: string | null;
  espnPlayerId: string | null;
  espnProfileUrl: string | null;
  height: string | null;
  weight: number | null;
  source: string;
};

export type DraftProspectProfileMatch = {
  espnPlayerId: string;
  espnProfileUrl: string | null;
  confidence: number;
  source: 'board' | 'search';
};

export type DraftProspectProfileRecord = {
  espnPlayerId: string;
  espnProfileUrl: string | null;
  headshotUrl: string | null;
  position: string | null;
  school: string | null;
  age: number | null;
  classYear: string | null;
  height: string | null;
  weight: number | null;
  hometown: string | null;
  stats: UnifiedPlayerStats;
};

const normalizeSchool = (value: string | null | undefined) =>
  normalizeTeamName(value ?? '')
    .replace(/\bstate\b/g, 'st')
    .replace(/\bflorida\b/g, 'fl')
    .replace(/\bsaint\b/g, 'st')
    .trim();

const toHttps = (value: string | undefined | null) =>
  value ? value.replace('http://', 'https://') : null;

const requestText = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'GET',
        agent: insecureAgent,
        headers: {
          Accept: 'application/json, text/html;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Five Wide Draft Sync)',
        },
      },
      (response) => {
        if (!response.statusCode || response.statusCode >= 400) {
          reject(new Error(`Request failed (${response.statusCode ?? 0}) for ${url}`));
          return;
        }
        const chunks: string[] = [];
        response.setEncoding('utf8');
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(chunks.join('')));
      },
    );
    request.on('error', reject);
    request.end();
  });

const requestJson = async <T>(url: string): Promise<T> => JSON.parse(await requestText(url)) as T;

const extractBoardJson = (html: string): EspnDraftBoardPayload => {
  const match = html.match(/espn\.draftcast\.data = (\{.*?\});\s*espn\.draftcast\.isAjax/s);
  if (!match?.[1]) {
    throw new Error('Unable to locate ESPN draft board payload');
  }
  return JSON.parse(match[1]) as EspnDraftBoardPayload;
};

const getAttribute = (athlete: EspnDraftBoardAthlete, key: string): string | null =>
  athlete.attributes?.find((attribute) => attribute.name === key)?.displayValue?.trim() ?? null;

const getPositionLabel = (
  athlete: EspnDraftBoardAthlete,
  positionsById: Map<string, string>,
): string | null => {
  const id = athlete.position?.id;
  if (!id) return null;
  return positionsById.get(id) ?? null;
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

const scoreSearchCandidate = ({
  candidate,
  normalizedName,
  school,
  position,
}: {
  candidate: EspnSearchPlayerResult;
  normalizedName: string;
  school: string | null;
  position: string | null;
}): number => {
  const candidateName = normalizePlayerName(candidate.displayName ?? '');
  if (!candidateName || candidateName !== normalizedName) {
    return 0;
  }

  let score = 60;
  const subtitle = normalizeSchool(candidate.subtitle);
  if (school && subtitle.includes(normalizeSchool(school))) {
    score += 30;
  }
  if (position && subtitle.includes(position.toLowerCase())) {
    score += 10;
  }
  return score;
};

const mapEspnStatCategoriesToUnifiedStats = (
  response: EspnAthleteStatsResponse,
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
  if (rushing?.get('yardsPerRushAttempt') !== undefined)
    stats.yardsPerCarry = rushing.get('yardsPerRushAttempt');

  if (receiving?.get('receivingYards') !== undefined)
    stats.recYards = receiving.get('receivingYards');
  if (receiving?.get('receptions') !== undefined) stats.receptions = receiving.get('receptions');
  if (receiving?.get('receivingTouchdowns') !== undefined)
    stats.recTD = receiving.get('receivingTouchdowns');
  if (receiving?.get('yardsPerReception') !== undefined)
    stats.yardsPerCatch = receiving.get('yardsPerReception');

  if (defense?.get('totalTackles') !== undefined) stats.tackles = defense.get('totalTackles');
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

const selectLatestSeasonStatsRef = (statsLog: EspnStatsLogResponse): string | null => {
  const entries = statsLog.entries ?? [];
  const latest = entries
    .map((entry) => {
      const seasonRef = entry.season?.$ref ?? '';
      const seasonMatch = seasonRef.match(/\/seasons\/(\d+)/);
      const season = seasonMatch?.[1] ? Number.parseInt(seasonMatch[1], 10) : 0;
      const totalStatsRef =
        entry.statistics?.find((item) => item.type === 'total')?.statistics?.$ref ?? null;
      return { season, ref: totalStatsRef };
    })
    .filter((entry): entry is { season: number; ref: string } => Boolean(entry.season && entry.ref))
    .sort((a, b) => b.season - a.season)[0];

  return latest?.ref ? toHttps(latest.ref) : null;
};

export const fetchEspnDraftBoardRankings = async (): Promise<DraftBoardRankingRecord[]> => {
  const html = await requestText(ESPN_DRAFT_BEST_AVAILABLE_URL);
  const payload = extractBoardJson(html);
  const positionsById = new Map(
    (payload.positions ?? [])
      .filter((position): position is { id: string; abbreviation?: string; displayName?: string } =>
        Boolean(position.id),
      )
      .map((position) => [
        position.id,
        position.abbreviation ?? position.displayName ?? position.id,
      ]),
  );

  return (payload.bestAvailable?.athletes ?? []).map((athlete) => {
    const overallRank = getAttribute(athlete, 'overall');
    const grade = getAttribute(athlete, 'grade');
    const school =
      athlete.team?.shortDisplayName ?? athlete.team?.location ?? athlete.team?.name ?? null;
    return {
      ranking: overallRank ? Number.parseInt(overallRank, 10) : null,
      grade,
      name: athlete.displayName?.trim() ?? 'Unknown Prospect',
      normalizedName: normalizePlayerName(athlete.displayName ?? ''),
      school,
      position: getPositionLabel(athlete, positionsById),
      headshotUrl: athlete.headshot?.href?.trim() ?? null,
      espnPlayerId: athlete.alternativeId?.trim() ?? null,
      espnProfileUrl: athlete.link?.trim() ?? null,
      height: athlete.displayHeight?.trim() ?? null,
      weight: athlete.weight ?? null,
      source: ESPN_DRAFT_BEST_AVAILABLE_URL,
    };
  });
};

export const resolveEspnDraftProspectProfile = async ({
  name,
  school,
  position,
  boardEspnPlayerId,
  boardEspnProfileUrl,
}: {
  name: string;
  school: string | null;
  position: string | null;
  boardEspnPlayerId?: string | null;
  boardEspnProfileUrl?: string | null;
}): Promise<DraftProspectProfileMatch | null> => {
  if (boardEspnPlayerId) {
    return {
      espnPlayerId: boardEspnPlayerId,
      espnProfileUrl: boardEspnProfileUrl ?? null,
      confidence: 100,
      source: 'board',
    };
  }

  const payload = await requestJson<EspnAthleteSearchResponse>(
    `${ESPN_SEARCH_URL}?query=${encodeURIComponent(name)}`,
  );
  const candidates =
    payload.results?.find((result) => result.type === 'player')?.contents?.filter(Boolean) ?? [];
  const normalizedName = normalizePlayerName(name);

  let bestMatch: DraftProspectProfileMatch | null = null;

  for (const candidate of candidates.slice(0, 8)) {
    const espnPlayerId = extractEspnAthleteId(candidate);
    if (!espnPlayerId) continue;
    const confidence = scoreSearchCandidate({
      candidate,
      normalizedName,
      school,
      position,
    });
    if (confidence < 70) continue;
    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = {
        espnPlayerId,
        espnProfileUrl: candidate.link?.web ?? null,
        confidence,
        source: 'search',
      };
    }
  }

  return bestMatch;
};

export const fetchEspnDraftProspectProfile = async (
  espnPlayerId: string,
): Promise<DraftProspectProfileRecord> => {
  const athlete = await requestJson<EspnCollegeAthlete>(
    `${ESPN_COLLEGE_ATHLETE_BASE_URL}/${espnPlayerId}?lang=en&region=us`,
  );

  const profileUrl =
    athlete.links?.find((link) => link.rel?.includes('overview'))?.href ??
    athlete.links?.find((link) => link.rel?.includes('playercard'))?.href ??
    null;

  const statsLogRef = toHttps(athlete.statisticslog?.$ref);
  let stats: UnifiedPlayerStats = {};
  if (statsLogRef) {
    try {
      const statsLog = await requestJson<EspnStatsLogResponse>(statsLogRef);
      const latestStatsRef = selectLatestSeasonStatsRef(statsLog);
      if (latestStatsRef) {
        const statsPayload = await requestJson<EspnAthleteStatsResponse>(latestStatsRef);
        stats = mapEspnStatCategoriesToUnifiedStats(statsPayload);
      }
    } catch {
      stats = {};
    }
  } else if (athlete.statistics?.$ref) {
    try {
      const statsPayload = await requestJson<EspnAthleteStatsResponse>(
        toHttps(athlete.statistics.$ref)!,
      );
      stats = mapEspnStatCategoriesToUnifiedStats(statsPayload);
    } catch {
      stats = {};
    }
  }

  const hometown = [athlete.birthPlace?.city, athlete.birthPlace?.state].filter(Boolean).join(', ');

  return {
    espnPlayerId,
    espnProfileUrl: profileUrl,
    headshotUrl: athlete.headshot?.href?.trim() ?? null,
    position: athlete.position?.abbreviation ?? athlete.position?.displayName ?? null,
    school: null,
    age: athlete.age ?? null,
    classYear: athlete.experience?.displayValue ?? athlete.experience?.abbreviation ?? null,
    height: athlete.displayHeight?.trim() ?? null,
    weight: athlete.weight ?? null,
    hometown: hometown || null,
    stats,
  };
};
