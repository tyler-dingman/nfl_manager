export type SourceCategory =
  | 'OFFICIAL'
  | 'NATIONAL_INSIDER'
  | 'LOCAL_BEAT'
  | 'LOCAL_MEDIA'
  | 'CREATOR'
  | 'AGGREGATOR'
  | 'COMMUNITY'
  | 'DATA';

export type SourcePlatform = 'WEB' | 'RSS' | 'X' | 'YOUTUBE' | 'REDDIT' | 'INSTAGRAM';

export type SourceDefinition = {
  id: string;
  name: string;
  displayName: string;
  team: string | null;
  category: SourceCategory;
  trustScore: number;
  breakingNewsScore: number;
  analysisScore: number;
  teamRelevanceScore: number;
  fanInterestScore?: number;
  creatorQualityScore?: number;
  teamExpertiseScore?: number;
  clickbaitScore?: number;
  videoProductionScore?: number;
  analysisDepthScore?: number;
  platform: SourcePlatform;
  handle?: string;
  url?: string;
  rssUrl?: string;
  youtubeChannelId?: string;
  enabled: boolean;
  priority: number;
  isAggregator?: boolean;
  parentSourceId?: string;
  notes?: string;
};

export type VideoSourceDefinition = Pick<
  SourceDefinition,
  | 'id'
  | 'displayName'
  | 'team'
  | 'trustScore'
  | 'creatorQualityScore'
  | 'priority'
  | 'enabled'
  | 'youtubeChannelId'
>;
