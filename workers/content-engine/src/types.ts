import type { TeamId } from './teams';
export type RecordData = { [field: string]: unknown };
export interface Source extends RecordData {
  id: string;
  teamId: TeamId | null;
  teamIds: TeamId[];
  leagueWide: boolean;
  enabled: boolean;
  platform: string;
  priority: number;
  nextCheckAt: number;
  name: string;
  url: string;
}
export interface SourceCheck extends RecordData {
  id: string;
  sourceId: string;
  attemptedAt: number;
  successful: boolean;
  nextCheckAt: number;
  etag?: string | null;
  lastModified?: string | null;
  cursor?: unknown;
}
export interface Candidate extends RecordData {
  id: string;
  sourceId: string;
  externalId: string;
  canonicalUrl: string;
  fingerprint: string;
  status: string;
  publishedAt: number;
  discoveredAt: number;
  teamIds: TeamId[];
  title: string;
  rawText: string;
}
export type PublicationState = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'WITHDRAWN';
export interface Story extends RecordData {
  id: string;
  teamId: TeamId | null;
  storyType: string;
  publicationState: PublicationState;
  status: string;
  headline: string;
  summary: string;
  importanceScore: number;
  confidenceScore: number;
  firstReportedAt: number;
  meaningfulUpdateAt: number;
  latestEvidenceAt: number | null;
  hotReadUntil: number | null;
  gameId: string | null;
  version: number;
  entityKeys: string[];
}
export interface Evidence extends RecordData {
  id: string;
  storyId: string;
  candidateId: string;
  sourceId: string;
  firstSeenAt: number;
}
export interface Video extends RecordData {
  videoId: string;
  sourceId: string;
  publishedAt: number;
  metadataCheckedAt: number | null;
  availability: 'PUBLIC' | 'UNLISTED' | 'PRIVATE' | 'DELETED' | 'UNAVAILABLE';
  teamIds: TeamId[];
  title: string;
  description: string;
  viewCount: number | null;
}
export interface Edition extends RecordData {
  id: string;
  teamId: TeamId;
  briefingDate: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'UNAVAILABLE';
  generatedAt: number;
  sourceFingerprint: string;
  items: RecordData[];
}
export interface JobInput {
  id: string;
  jobType: string;
  idempotencyKey: string;
  sourceId?: string;
  candidateId?: string;
  teamId?: TeamId;
  availableAt: number;
  maxAttempts?: number;
  ownerEpoch: number;
  payload: RecordData;
}
export interface JobRow {
  id: string;
  status: string;
  lease_token: string;
  lease_until: number;
  attempts: number;
  owner_epoch: number;
  payload_json: string;
}
export interface Cursor {
  time: number;
  id: string;
}
export interface Page<T> {
  items: T[];
  nextCursor: Cursor | null;
}
export interface Meter {
  label: string;
  statements: number;
  rowsRead: number;
  rowsWritten: number;
  durationMs: number;
}
