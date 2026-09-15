import { TEAM_LIST } from '@/data/teams';
import { resolveNewsGraphicVariant } from '@/components/front-office/news-graphics/news-graphic-variant';
import type {
  NewsGraphicTeam,
  NewsGraphicVariant,
} from '@/components/front-office/news-graphics/NewsGraphic';
import type { FrontOfficeEvent } from '@/types/front-office';

export type LeagueNewsCategory =
  | 'ALL'
  | 'RUMOR'
  | 'INJURY'
  | 'TRANSACTION'
  | 'CONTRACT'
  | 'GAME_RECAP'
  | 'ANALYSIS'
  | 'MY_TEAM';

export type LeagueNewsStory = {
  id: string;
  event: FrontOfficeEvent;
  category: Exclude<LeagueNewsCategory, 'ALL' | 'MY_TEAM'>;
  categoryLabel: string;
  graphicVariant: NewsGraphicVariant;
  headline: string;
  summary: string;
  team?: NewsGraphicTeam;
  opponent?: NewsGraphicTeam;
  authorName: string;
  authorHandle: string;
  importanceScore: number;
  trendingScore: number;
  publishedAt: string;
};

const numericMetadata = (event: FrontOfficeEvent, key: string) => {
  const value = Number(event.metadata[key]);
  return Number.isFinite(value) ? value : 0;
};

export const toNewsTeam = (abbr: string | null): NewsGraphicTeam | undefined => {
  const team = TEAM_LIST.find((entry) => entry.abbr === abbr);
  return team
    ? {
        id: team.id,
        abbreviation: team.abbr,
        displayName: `${team.city} ${team.name}`,
        primaryColor: team.colors[0],
        secondaryColor: team.colors[1],
      }
    : undefined;
};

const categoryFor = (event: FrontOfficeEvent): LeagueNewsStory['category'] => {
  const explicit = String(event.metadata.newsCategory ?? '').toUpperCase();
  if (['RUMOR', 'INJURY', 'TRANSACTION', 'CONTRACT', 'GAME_RECAP', 'ANALYSIS'].includes(explicit))
    return explicit as LeagueNewsStory['category'];
  if (['trade_rumor', 'trade_interest', 'trade_offer'].includes(event.type)) return 'RUMOR';
  if (['free_agent_signing', 'player_release', 'league_transaction'].includes(event.type))
    return 'TRANSACTION';
  if (['contract_extension', 're_sign_ready'].includes(event.type)) return 'CONTRACT';
  if (event.type === 'draft_buzz' || event.type === 'playoff_update') return 'ANALYSIS';
  return 'ANALYSIS';
};

const authorFor = (category: LeagueNewsStory['category'], teamRelevant: boolean) => {
  if (teamRelevant) return { authorName: 'D&D Local', authorHandle: '@DDLocal' };
  if (category === 'RUMOR' || category === 'CONTRACT')
    return { authorName: 'D&D Insider', authorHandle: '@DDInsider' };
  if (category === 'TRANSACTION')
    return { authorName: 'D&D Transactions', authorHandle: '@DDTransactions' };
  if (category === 'GAME_RECAP')
    return { authorName: 'Jake Turner', authorHandle: '@JakeTurnerDD' };
  return { authorName: 'D&D League Desk', authorHandle: '@DDLeagueDesk' };
};

export function eventToLeagueNewsStory(
  event: FrontOfficeEvent,
  selectedTeamAbbr: string,
  now = Date.now(),
): LeagueNewsStory {
  const category = categoryFor(event);
  const teamRelevant = [event.teamAbbr, event.relatedTeamAbbr].includes(selectedTeamAbbr);
  const importanceScore =
    numericMetadata(event, 'importanceScore') ||
    ({ urgent: 95, high: 82, normal: 62, low: 45 } as const)[event.priority];
  const engagement =
    numericMetadata(event, 'likes') +
    numericMetadata(event, 'replies') * 2 +
    numericMetadata(event, 'reposts') * 1.5;
  const ageHours = Math.max(0, (now - new Date(event.createdAt).getTime()) / 3_600_000);
  const trendingScore =
    importanceScore + Math.log2(engagement + 1) * 4 + Math.max(0, 36 - ageHours);
  return {
    id: event.id,
    event,
    category,
    categoryLabel: category.replace('_', ' '),
    graphicVariant: resolveNewsGraphicVariant(`${category} ${event.type}`, event.headline),
    headline: event.headline,
    summary: event.summary,
    team: toNewsTeam(event.teamAbbr),
    opponent: toNewsTeam(event.relatedTeamAbbr),
    ...authorFor(category, teamRelevant),
    importanceScore,
    trendingScore,
    publishedAt: event.createdAt,
  };
}

export function relativeNewsTime(value: string, now = Date.now()) {
  const hours = Math.max(0, Math.floor((now - new Date(value).getTime()) / 3_600_000));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
