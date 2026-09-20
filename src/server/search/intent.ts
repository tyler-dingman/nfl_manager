import { TEAM_LIST } from '@/data/teams';
import type { InformationPlan, SearchContext, SearchIntent } from '@/features/search/answer-types';

export function classifyIntent(query: string): SearchIntent {
  const q = query.toLowerCase().replace(/[’']/g, '');
  if (/how often|cleared|gone over|trending over|done against/i.test(q)) return 'BETTING_ANALYSIS';
  if (
    /\b(props?|touchdown odds)\b/.test(q) ||
    (/passing|receiving|rushing|receptions|touchdown|\btd\b/.test(q) &&
      /odds|line|over.?under/.test(q))
  )
    return 'PLAYER_PROPS';
  if (/betting lines/.test(q)) return 'ODDS';
  if (/\b(total|career|season)\s+(passing|rushing|receiving|yards|touchdowns|sacks)/.test(q))
    return 'PLAYER_STATS';
  if (/\b(offensive|defensive) line\b/.test(q)) return /injur|hurt/.test(q) ? 'INJURIES' : 'NEWS';
  if (/\b(over[\s/-]*under|o\/u|total(?:s)?|point total)\b/.test(q)) return 'TOTAL';
  if (/\b(money\s?line)\b/.test(q)) return 'MONEYLINE';
  if (/\b(spread|line|favou?rite|favou?red)\b/.test(q)) return 'SPREAD';
  if (/\b(odds|betting)\b/.test(q)) return 'ODDS';
  if (/\b(after that|following game|game after)\b/.test(q)) return 'FOLLOW_UP';
  if (
    /\b(next game|play next|playing next|when.*play|who.*play|kickoff|what time|what channel)\b/.test(
      q,
    )
  )
    return 'NEXT_GAME';
  if (/\b(schedule|upcoming games|remaining games)\b/.test(q)) return 'SCHEDULE';
  if (/\b(last game|previous game|last week|last night|did.*win)\b/.test(q)) return 'PREVIOUS_GAME';
  if (/\b(score|scored|winning)\b/.test(q)) return 'SCORE';
  if (/\b(playoff|postseason)\b/.test(q)) return 'PLAYOFF_OUTLOOK';
  if (/\b(standings|division rank|conference rank)\b/.test(q)) return 'STANDINGS';
  if (/\b(record|wins|losses)\b/.test(q)) return 'TEAM_RECORD';
  if (/\b(is .+ (playing|active|out)|will .+ play|status of)\b/.test(q)) return 'PLAYER_STATUS';
  if (/\b(injur\w*|hurt|questionable|doubtful)\b/.test(q)) return 'INJURIES';
  if (/\b(roster moves|transactions|signed|released|waived|elevat\w*|traded)\b/.test(q))
    return 'TRANSACTIONS';
  if (/\b(draft picks|pick ownership|draft capital)\b/.test(q)) return 'DRAFT_PICKS';
  if (/\b(prospect|prospects|big board)\b/.test(q)) return 'PROSPECTS';
  if (/\b(draft)\b/.test(q)) return 'DRAFT';
  if (/\b(rookie impact|rookies contributing)\b/.test(q)) return 'PLAYER_STATS';
  if (/\b(team stats|offense|defense|yards allowed)\b/.test(q)) return 'TEAM_STATS';
  if (/\b(stats|statistics|yards|touchdowns|snap counts|receptions|sacks)\b/.test(q))
    return 'PLAYER_STATS';
  if (/\b(roster|depth chart|who plays)\b/.test(q)) return 'ROSTER';
  if (/\b(catch me up|what did i miss|whats going on|latest|briefing)\b/.test(q))
    return 'TEAM_BRIEFING';
  if (/\b(breaking)\b/.test(q)) return 'BREAKING_NEWS';
  if (/\b(news|updates|said|say|report)\b/.test(q)) return 'NEWS';
  if (/\b(compare|comparison|versus| vs\.? |better than)\b/.test(q)) return 'COMPARISON';
  return 'GENERAL_TEAM_QUESTION';
}
export function mentionedTeams(query: string) {
  const q = ` ${query.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')} `;
  return TEAM_LIST.filter((t) =>
    [t.name, t.name.split(' ').at(-1)!, t.abbr].some((n) => q.includes(` ${n.toLowerCase()} `)),
  );
}
export function buildInformationPlan(
  query: string,
  selectedTeamId: string,
  context?: SearchContext,
  override?: SearchIntent,
): InformationPlan {
  const mentioned = mentionedTeams(query);
  const previous = context?.selectedTeamId === selectedTeamId ? context : undefined;
  const teamId = mentioned[0]?.abbr ?? previous?.currentTeam ?? selectedTeamId;
  let intent = override ?? classifyIntent(query);
  if (
    intent === 'GENERAL_TEAM_QUESTION' &&
    mentioned.length &&
    /^(and|what about|how about)\b/i.test(query.trim()) &&
    previous?.lastIntent
  ) {
    intent = previous.lastIntent === 'FOLLOW_UP' ? 'NEXT_GAME' : previous.lastIntent;
  }
  if (intent === 'FOLLOW_UP' && !/after that|following game|game after/i.test(query))
    intent = previous?.lastIntent ?? 'GENERAL_TEAM_QUESTION';
  const plan: InformationPlan = { teamId, intent, needs: [], comparisonTeam: mentioned[1]?.abbr };
  const sameTeam = previous?.currentTeam === teamId && !mentioned.length;
  if (sameTeam && previous?.lastReferencedGame) {
    if (intent === 'FOLLOW_UP') plan.afterGame = previous.lastReferencedGame;
    else if (['ODDS', 'TOTAL', 'SPREAD', 'MONEYLINE', 'PLAYER_PROPS', 'SCORE'].includes(intent))
      plan.referenceGame = previous.lastReferencedGame;
  }
  const needs: Partial<Record<SearchIntent, InformationPlan['needs']>> = {
    NEXT_GAME: ['schedule'],
    SCHEDULE: ['schedule'],
    FOLLOW_UP: ['schedule'],
    PREVIOUS_GAME: ['schedule'],
    SCORE: ['schedule'],
    STANDINGS: ['standings'],
    TEAM_RECORD: ['standings'],
    PLAYOFF_OUTLOOK: ['standings', 'schedule'],
    ODDS: ['schedule', 'odds'],
    PLAYER_PROPS: ['schedule', 'odds'],
    BETTING_ANALYSIS: [],
    TOTAL: ['schedule', 'odds'],
    SPREAD: ['schedule', 'odds'],
    MONEYLINE: ['schedule', 'odds'],
    INJURIES: ['injuries', 'news'],
    PLAYER_STATUS: ['injuries', 'roster', 'news'],
    TRANSACTIONS: ['transactions', 'news'],
    ROSTER: ['roster'],
    PLAYER_STATS: ['stats', 'roster'],
    TEAM_STATS: ['stats'],
    TEAM_BRIEFING: ['schedule', 'standings', 'injuries', 'transactions', 'news'],
    CATCH_ME_UP: ['schedule', 'standings', 'injuries', 'transactions', 'news'],
    DRAFT: ['news', 'prospects'],
    DRAFT_PICKS: ['news'],
    PROSPECTS: ['prospects'],
    NEWS: ['news'],
    BREAKING_NEWS: ['news'],
    GENERAL_TEAM_QUESTION: ['news'],
    COMPARISON: ['standings', 'stats'],
  };
  plan.needs = needs[intent] ?? ['news'];
  if (intent === 'PLAYER_STATS' && /rookie/i.test(query))
    plan.needs = ['stats', 'roster', 'news', 'schedule'];
  if (intent === 'FOLLOW_UP' && !plan.afterGame) plan.ambiguous = true;
  return plan;
}
