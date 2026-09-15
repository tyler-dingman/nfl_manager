export type TeamStoryType =
  | 'GAME_RESULT'
  | 'BREAKOUT_PERFORMANCE'
  | 'RECORD_OR_MILESTONE'
  | 'MAJOR_INJURY'
  | 'INJURY_UPDATE'
  | 'MAJOR_TRANSACTION'
  | 'DEPTH_CHART_CHANGE'
  | 'UPCOMING_GAME'
  | 'COACHING_CHANGE'
  | 'ROSTER_MOVE'
  | 'PRACTICE_UPDATE'
  | 'GENERAL_NEWS';

export type ImportanceCandidate = {
  id: string;
  headline: string;
  summary?: string | null;
  category?: string | null;
  updatedAt: string;
  publishedAt?: string | null;
  sourceCount?: number;
  officialSource?: boolean;
  importanceScore?: number;
  status?: string | null;
};

export type ImportanceScore = {
  type: TeamStoryType;
  score: number;
  components: {
    base: number;
    freshness: number;
    sourceQuality: number;
    corroboration: number;
    status: number;
    existingImportance: number;
  };
  reasons: string[];
};

export const TEAM_STORY_BASE_PRIORITY: Record<TeamStoryType, number> = {
  GAME_RESULT: 92,
  BREAKOUT_PERFORMANCE: 88,
  RECORD_OR_MILESTONE: 86,
  MAJOR_INJURY: 84,
  MAJOR_TRANSACTION: 80,
  COACHING_CHANGE: 76,
  DEPTH_CHART_CHANGE: 67,
  INJURY_UPDATE: 64,
  UPCOMING_GAME: 58,
  ROSTER_MOVE: 48,
  PRACTICE_UPDATE: 35,
  GENERAL_NEWS: 25,
};

const textFor = (story: ImportanceCandidate) =>
  `${story.category ?? ''} ${story.headline} ${story.summary ?? ''}`.toLowerCase();

export function classifyTeamStory(story: ImportanceCandidate): TeamStoryType {
  const text = textFor(story);
  const category = (story.category ?? '').toLowerCase();
  if (
    /final score|game recap|defeat(?:ed|s)?|victory|beats?\b|wins?\b|loss\b|postgame|falls? to/.test(
      text,
    )
  )
    return 'GAME_RESULT';
  if (
    /record[- ]setting|franchise record|nfl record|career high|milestone|historic|history/.test(
      text,
    )
  )
    return 'RECORD_OR_MILESTONE';
  if (
    /breakout|career-best|career best|dominant debut|historic debut|player of the week|six touchdowns|five touchdowns/.test(
      text,
    )
  )
    return 'BREAKOUT_PERFORMANCE';
  if (
    /(season-ending|torn acl|torn achilles|placed on injured reserve|out for season|major injury)/.test(
      text,
    )
  )
    return 'MAJOR_INJURY';
  if (
    /head coach|offensive coordinator|defensive coordinator|fired|hired as coach|coaching change/.test(
      text,
    )
  )
    return 'COACHING_CHANGE';
  if (
    /blockbuster|major trade|acquire[ds]?|traded for|contract extension|signs? .* contract/.test(
      text,
    )
  )
    return 'MAJOR_TRANSACTION';
  if (/trade|transaction|contract|signing/.test(category)) return 'MAJOR_TRANSACTION';
  if (/starter|starting role|depth chart|named .* quarterback|benched|promoted to/.test(text))
    return 'DEPTH_CHART_CHANGE';
  if (/injur|questionable|doubtful|ruled out|limited participant|return to practice/.test(text))
    return 'INJURY_UPDATE';
  if (/injur/.test(category)) return 'INJURY_UPDATE';
  if (/preview|matchup|kickoff|faces?\b|week \d+|upcoming game/.test(text)) return 'UPCOMING_GAME';
  if (/game|preview/.test(category)) return 'UPCOMING_GAME';
  if (/waiv|release[ds]?|practice squad|roster move|claimed/.test(text)) return 'ROSTER_MOVE';
  if (/practice|training camp|availability report/.test(text)) return 'PRACTICE_UPDATE';
  if (/coach/.test(category)) return 'COACHING_CHANGE';
  if (/practice/.test(category)) return 'PRACTICE_UPDATE';
  return 'GENERAL_NEWS';
}

const freshnessPoints = (ageHours: number, type: TeamStoryType) => {
  if (ageHours <= 18)
    return type === 'GAME_RESULT' ||
      type === 'BREAKOUT_PERFORMANCE' ||
      type === 'RECORD_OR_MILESTONE'
      ? 30
      : 22;
  if (ageHours <= 36) return 15;
  if (ageHours <= 72) return 8;
  if (ageHours <= 168) return 3;
  return 0;
};

export function scoreTeamStory(story: ImportanceCandidate, now = new Date()): ImportanceScore {
  const type = classifyTeamStory(story);
  const timestamp = new Date(story.updatedAt || story.publishedAt || 0).getTime();
  const ageHours = Number.isFinite(timestamp)
    ? Math.max(0, (now.getTime() - timestamp) / 3_600_000)
    : 10_000;
  const components = {
    base: TEAM_STORY_BASE_PRIORITY[type],
    freshness: freshnessPoints(ageHours, type),
    sourceQuality: story.officialSource ? 8 : 0,
    corroboration: Math.min(10, Math.max(0, (story.sourceCount ?? 1) - 1) * 3),
    status: story.status === 'BREAKING' ? 12 : story.status === 'DEVELOPING' ? 5 : 0,
    existingImportance: Math.round(Math.max(0, Math.min(100, story.importanceScore ?? 50)) * 0.12),
  };
  const reasons = [`${type.replaceAll('_', ' ')} base priority`, `${Math.round(ageHours)}h old`];
  if (components.freshness) reasons.push('freshness boost');
  if (components.sourceQuality) reasons.push('official source');
  if (components.corroboration) reasons.push(`${story.sourceCount} sources`);
  return {
    type,
    score: Object.values(components).reduce((sum, value) => sum + value, 0),
    components,
    reasons,
  };
}

export function rankTeamStories<T extends ImportanceCandidate>(stories: T[], now = new Date()) {
  return [...stories].sort((left, right) => {
    const scoreDifference = scoreTeamStory(right, now).score - scoreTeamStory(left, now).score;
    return (
      scoreDifference ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function storyTopicKey(story: ImportanceCandidate) {
  return textFor(story)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|and|or|of|to|for|in|on|at|with|latest|update|report)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildRankingDiagnostics(stories: ImportanceCandidate[], now = new Date()) {
  return rankTeamStories(stories, now).map((story, index) => ({
    rank: index + 1,
    id: story.id,
    headline: story.headline,
    ...scoreTeamStory(story, now),
  }));
}
