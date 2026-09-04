import type { EventType } from '@/features/source-engine/types';

export type PollingTier = 'A' | 'B' | 'C';
export type FetchStrategy = 'RSS' | 'HTML' | 'STRUCTURED_API' | 'FIXTURE';
export type CandidateStatus =
  | 'NEW'
  | 'ANALYZED'
  | 'DUPLICATE'
  | 'CLUSTERED'
  | 'REVIEW_REQUIRED'
  | 'REJECTED'
  | 'FAILED';
export type CanonicalStoryStatus = 'BREAKING' | 'DEVELOPING' | 'HOLDING' | 'RESOLVED';
export type PublicationState =
  | 'DRAFT'
  | 'AUTO_PUBLISHED'
  | 'REVIEW_REQUIRED'
  | 'PUBLISHED'
  | 'REJECTED';
export type MaterialChangeType =
  | 'NEW_FACT'
  | 'STATUS_CHANGE'
  | 'INJURY_UPDATE'
  | 'TRANSACTION_UPDATE'
  | 'OFFICIAL_CONFIRMATION'
  | 'CORRECTION'
  | 'RESOLUTION'
  | 'IMPORTANCE_CHANGE'
  | 'SOURCE_CONFIRMATION'
  | 'TRIVIAL';

export type RegisteredSource = {
  id: string;
  name: string;
  sourceType: string;
  teamId: string | null;
  leagueWide: boolean;
  url: string;
  feedUrl: string | null;
  fetchStrategy: FetchStrategy;
  pollingTier: PollingTier;
  priority: number;
  reliabilityScore: number;
  checkIntervalSeconds: number;
  enabled: boolean;
  etag: string | null;
  lastModified: string | null;
  lastCheckedAt: Date | null;
  lastSuccessfulAt: Date | null;
  nextCheckAt: Date;
  failureCount: number;
  lastError: string | null;
  metadata: Record<string, unknown>;
};

export type RawSourceItem = {
  sourceId: string;
  externalId: string;
  url: string;
  title: string;
  author: string | null;
  publishedAt: string;
  updatedAt: string | null;
  rawText: string;
  excerpt: string;
  media: Array<{ type: string; url: string }>;
  fetchedAt: string;
};

export type ContentCandidate = {
  id?: string;
  sourceId: string;
  externalId: string;
  url: string;
  title: string;
  normalizedTitle: string;
  author: string | null;
  publishedAt: string;
  discoveredAt: string;
  text: string;
  excerpt: string;
  entities: string[];
  candidateTeams: string[];
  fingerprint: string;
  status: CandidateStatus;
  storyType: EventType;
};

export type StoryRecord = {
  id: string;
  teamId: string | null;
  storyType: EventType;
  headline: string;
  summary: string;
  whatHappened: string;
  whyItMatters: string;
  whatsNext: string;
  status: CanonicalStoryStatus;
  publicationState: PublicationState;
  importanceScore: number;
  confidenceScore: number;
  entities: string[];
  firstReportedAt: string | Date;
  lastMeaningfulUpdateAt: string | Date;
  version: number;
  sourceItemCount?: number;
  publisherCount?: number;
  independentSourceCount?: number;
  hotReadQualifiedAt?: string | Date | null;
  hotReadUntil?: string | Date | null;
  clusterReason?: string | null;
};

export type MaterialChangeResult = {
  material: boolean;
  severity: number;
  changeType: MaterialChangeType;
  reason: string;
};
export type GeneratedClaim = { text: string; sourceEvidenceIds: string[]; confidence: number };
export type SynthesizedStory = Pick<
  StoryRecord,
  | 'headline'
  | 'summary'
  | 'whatHappened'
  | 'whyItMatters'
  | 'whatsNext'
  | 'status'
  | 'importanceScore'
  | 'confidenceScore'
> & { claims: GeneratedClaim[] };
