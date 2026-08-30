export type EventStatus = 'RUMOR' | 'DEVELOPING' | 'REPORTED' | 'CONFIRMED' | 'OFFICIAL';

export type EventType =
  | 'TRANSACTION'
  | 'TRADE'
  | 'SIGNING'
  | 'RELEASE'
  | 'INJURY'
  | 'PRACTICE'
  | 'DEPTH_CHART'
  | 'CONTRACT'
  | 'COACHING'
  | 'DRAFT'
  | 'GAME'
  | 'SUSPENSION'
  | 'QUOTE'
  | 'ROSTER'
  | 'RUMOR'
  | 'ANALYSIS';

export type SourceItem = {
  id: string;
  sourceId: string;
  teamIds: string[];
  type: EventType;
  title: string;
  excerpt: string;
  url: string;
  publishedAt: string;
  author?: string;
  entities: string[];
  claims: string[];
  tags: string[];
  platformId?: string;
  originalSourceId?: string;
  reportedBy?: string;
  referencedSources?: string[];
  engagementScore?: number;
  videoId?: string;
};

export type EventUpdate = {
  id: string;
  eventId: string;
  sourceItemIds: string[];
  headline: string;
  summary: string;
  status: EventStatus;
  createdAt: string;
};

export type CanonicalEvent = {
  id: string;
  storyId: string;
  teamId: string;
  sport: 'NFL';
  type: EventType;
  headline: string;
  summary: string;
  status: EventStatus;
  importanceScore: number;
  confidenceScore: number;
  freshnessScore: number;
  fanInterestScore: number;
  teamRelevanceScore: number;
  huddleScore: number;
  createdAt: string;
  updatedAt: string;
  firstReportedAt: string;
  officialAt?: string;
  entities: string[];
  sourceItems: SourceItem[];
  relatedVideos: SourceItem[];
  communityLinks: SourceItem[];
  tags: string[];
  updates: EventUpdate[];
};

export type Story = {
  id: string;
  teamId: string;
  title: string;
  eventIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type HuddleWeights = {
  importance: number;
  teamRelevance: number;
  freshness: number;
  fanInterest: number;
  confidence: number;
};

export const DEFAULT_HUDDLE_WEIGHTS: HuddleWeights = {
  importance: 0.3,
  teamRelevance: 0.25,
  freshness: 0.2,
  fanInterest: 0.15,
  confidence: 0.1,
};
