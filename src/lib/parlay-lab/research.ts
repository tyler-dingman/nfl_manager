export type ResearchIntent = {
  legCount: number;
  teams: string[];
  positions: string[];
  side?: 'OVER' | 'UNDER';
  touchdownsOnly: boolean;
  plusMoney: boolean;
  confidence: 'balanced' | 'high';
};

const TEAM_ALIASES: Record<string, string> = {
  chiefs: 'KC',
  kc: 'KC',
  broncos: 'DEN',
  denver: 'DEN',
  den: 'DEN',
  bears: 'CHI',
  chicago: 'CHI',
  chi: 'CHI',
  bills: 'BUF',
  buffalo: 'BUF',
  dolphins: 'MIA',
  miami: 'MIA',
  vikings: 'MIN',
  minnesota: 'MIN',
  eagles: 'PHI',
  philadelphia: 'PHI',
  cowboys: 'DAL',
  dallas: 'DAL',
  packers: 'GB',
  greenbay: 'GB',
  niners: 'SF',
  '49ers': 'SF',
  rams: 'LAR',
};

export function parseResearchPrompt(input: string): ResearchIntent {
  const text = input.toLowerCase();
  const legMatch = text.match(/\b(\d+)\s*[- ]?leg/) ?? text.match(/\b(\d+)\b/);
  const teams = [
    ...new Set(
      Object.entries(TEAM_ALIASES)
        .filter(([alias]) => new RegExp(`\\b${alias}\\b`).test(text))
        .map(([, abbr]) => abbr),
    ),
  ];
  const positions = ['QB', 'RB', 'WR', 'TE'].filter((position) =>
    new RegExp(`\\b${position.toLowerCase()}s?\\b`).test(text),
  );
  return {
    legCount: Math.min(8, Math.max(1, Number(legMatch?.[1] ?? 3))),
    teams,
    positions,
    side: text.includes('under') ? 'UNDER' : text.includes('over') ? 'OVER' : undefined,
    touchdownsOnly: /touchdown|\btds?\b/.test(text),
    plusMoney: /plus[- ]money|underdog/.test(text),
    confidence: /high confidence|high historical hit[- ]rate|safer|conservative/.test(text)
      ? 'high'
      : 'balanced',
  };
}

export type ResearchCandidate = {
  id: string;
  eventId?: string;
  playerName: string | null;
  position?: string | null;
  teamId: string | null;
  marketType: string;
  statId: string;
  side: string;
  line: number | null;
  sportsbook: Sportsbook;
  odds: number | null;
  deeplink: string | null;
  trend?: {
    trendScore: number;
    sampleConfidence: string;
    last10: { games: number; hits: number };
  } | null;
};

export function generateResearchSlip(candidates: ResearchCandidate[], intent: ResearchIntent) {
  const historyAvailable = candidates.some((market) => market.trend);
  const filtered = candidates.filter((market) => {
    if (intent.teams.length && (!market.teamId || !intent.teams.includes(market.teamId)))
      return false;
    if (
      intent.positions.length &&
      (!market.position || !intent.positions.includes(market.position))
    )
      return false;
    if (intent.side && market.side !== intent.side) return false;
    if (
      intent.touchdownsOnly &&
      !/td|touchdown/.test(`${market.marketType} ${market.statId}`.toLowerCase())
    )
      return false;
    if (intent.plusMoney && (market.odds === null || market.odds <= 0)) return false;
    if (historyAvailable && (!market.trend || market.trend.trendScore < 45)) return false;
    if (intent.confidence === 'high' && market.trend?.sampleConfidence === 'LOW') return false;
    return true;
  });
  const unique = new Map<string, ResearchCandidate>();
  for (const market of filtered.sort((a, b) => {
    const trendDifference = (b.trend?.trendScore ?? 0) - (a.trend?.trendScore ?? 0);
    if (trendDifference) return trendDifference;
    if (intent.confidence === 'high') return (a.line ?? 0) - (b.line ?? 0);
    return Math.abs((a.odds ?? 0) + 105) - Math.abs((b.odds ?? 0) + 105);
  })) {
    const key = `${market.playerName ?? market.teamId}:${market.marketType}:${market.side}`;
    if (!unique.has(key)) unique.set(key, market);
    if (unique.size === intent.legCount) break;
  }
  return [...unique.values()];
}

export function researchScore(market: ResearchCandidate) {
  let score = 45;
  if (market.odds !== null && market.odds >= -200 && market.odds <= 200) score += 15;
  if (market.playerName) score += 10;
  if (market.trend) score += 20;
  return Math.min(90, score);
}
import type { Sportsbook } from '@/server/odds/sportsbooks';
