import { TEAM_LIST } from '@/data/teams';
import { resolveNewsGraphicVariant } from '@/components/front-office/news-graphics/news-graphic-variant';
import type {
  NewsGraphicTeam,
  NewsGraphicVariant,
} from '@/components/front-office/news-graphics/NewsGraphic';
import type { FrontOfficeEvent } from '@/types/front-office';
import type {
  FrontOfficeStoryGraphicModel,
  StoryGraphicTemplate,
} from '@/components/front-office/story-graphics/story-graphic-model';

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
  storyTemplate: StoryGraphicTemplate;
  isBreaking: boolean;
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

export function frontOfficeEventIncludesTeam(event: FrontOfficeEvent, teamAbbr: string) {
  const teamIds = event.metadata.teamIds;
  return Array.isArray(teamIds)
    ? teamIds.includes(teamAbbr)
    : [event.teamAbbr, event.relatedTeamAbbr].includes(teamAbbr);
}

export const toNewsTeam = (abbr: string | null): NewsGraphicTeam | undefined => {
  const team = TEAM_LIST.find((entry) => entry.abbr === abbr);
  return team
    ? {
        id: team.id,
        abbreviation: team.abbr,
        displayName: team.name.toLowerCase().startsWith(team.city.toLowerCase())
          ? team.name
          : `${team.city} ${team.name}`,
        primaryColor: team.colors[0],
        secondaryColor: team.colors[1],
        logoUrl: team.logoUrl,
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

export const storyTemplateFor = (event: FrontOfficeEvent): StoryGraphicTemplate => {
  const explicit = String(event.metadata.newsCategory ?? '').toUpperCase();
  const byCategory: Record<string, StoryGraphicTemplate> = {
    TRADE: 'trade',
    CONTRACT: 'contract',
    INJURY: 'injury',
    SIGNING: 'signing',
    RELEASE: 'release',
    ROSTER: 'roster',
    TRANSACTION: 'transaction',
    RUMOR: 'rumor',
    DRAFT: 'draft',
    GAME: 'game',
    GAME_RECAP: 'game',
    ANALYSIS: 'analysis',
    OTHER: 'other',
  };
  if (byCategory[explicit]) return byCategory[explicit];
  const byType: Partial<Record<FrontOfficeEvent['type'], StoryGraphicTemplate>> = {
    trade_rumor: 'rumor',
    trade_interest: 'rumor',
    trade_offer: 'trade',
    free_agent_signing: 'signing',
    player_release: 'release',
    contract_extension: 'contract',
    re_sign_ready: 'contract',
    draft_buzz: 'draft',
    league_transaction: 'transaction',
    playoff_update: 'game',
  };
  return byType[event.type] ?? 'other';
};

const authorFor = (category: LeagueNewsStory['category'], teamRelevant: boolean) => {
  void category;
  void teamRelevant;
  return { authorName: 'Front Office Newsroom', authorHandle: '' };
};

export function eventToLeagueNewsStory(
  event: FrontOfficeEvent,
  selectedTeamAbbr: string,
  now = Date.now(),
): LeagueNewsStory {
  const category = categoryFor(event);
  const teamRelevant = frontOfficeEventIncludesTeam(event, selectedTeamAbbr);
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
    storyTemplate: storyTemplateFor(event),
    isBreaking: event.priority === 'urgent' || event.type === 'breaking_news',
    headline: event.headline,
    summary: event.summary,
    team: toNewsTeam(event.teamAbbr),
    opponent: toNewsTeam(event.relatedTeamAbbr),
    ...authorFor(category, teamRelevant),
    importanceScore,
    trendingScore,
    publishedAt: String(event.metadata.sourcePublishedAt ?? event.createdAt),
  };
}

export function relativeNewsTime(value: string, now = Date.now()) {
  const ageMs = Math.max(0, now - new Date(value).getTime());
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(ageMs / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function leagueStoryGraphicModel(story: LeagueNewsStory): FrontOfficeStoryGraphicModel {
  const toIdentity = (team: LeagueNewsStory['team']) =>
    team
      ? {
          id: team.id,
          displayName: team.displayName,
          primary: team.primaryColor,
          secondary: team.secondaryColor,
          logoUrl: team.logoUrl,
        }
      : undefined;
  return {
    id: story.id,
    template: story.storyTemplate,
    headline: story.headline,
    eyebrow: story.isBreaking ? `Breaking · ${story.categoryLabel}` : story.categoryLabel,
    summary: story.summary,
    primaryIdentity: toIdentity(story.team),
    secondaryIdentity: toIdentity(story.opponent),
    status: story.isBreaking ? 'BREAKING' : undefined,
    source:
      typeof story.event.metadata.sourcePublisher === 'string'
        ? story.event.metadata.sourcePublisher
        : typeof story.event.metadata.source === 'string'
          ? story.event.metadata.source
          : undefined,
    dateLabel: relativeNewsTime(story.publishedAt),
  };
}
