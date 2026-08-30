import type { SourceDefinition } from '@/data/sources';

import type { EventStatus, HuddleWeights, SourceItem } from './types';
import { DEFAULT_HUDDLE_WEIGHTS } from './types';

const statusRank: Record<EventStatus, number> = {
  RUMOR: 0,
  DEVELOPING: 1,
  REPORTED: 2,
  CONFIRMED: 3,
  OFFICIAL: 4,
};

const uniqueOriginalReports = (items: SourceItem[]) =>
  new Set(items.map((item) => item.originalSourceId ?? item.reportedBy ?? item.sourceId));

export const determineStatus = (
  items: SourceItem[],
  definitions: Map<string, SourceDefinition>,
): EventStatus => {
  const originalItems = [...uniqueOriginalReports(items)].map((originalId) =>
    items.find(
      (item) => (item.originalSourceId ?? item.reportedBy ?? item.sourceId) === originalId,
    ),
  );
  const sources = originalItems
    .filter((item): item is SourceItem => Boolean(item))
    .map((item) => definitions.get(item.sourceId))
    .filter((source): source is SourceDefinition => Boolean(source));

  if (sources.some((source) => source.category === 'OFFICIAL')) return 'OFFICIAL';
  const authoritativeReports = sources.filter(
    (source) =>
      source.category === 'NATIONAL_INSIDER' ||
      source.category === 'LOCAL_BEAT' ||
      source.trustScore >= 90,
  );
  if (authoritativeReports.length >= 2) return 'CONFIRMED';
  if (authoritativeReports.length === 1) return 'REPORTED';
  if (sources.some((source) => source.trustScore >= 65)) return 'DEVELOPING';
  return 'RUMOR';
};

export const confidenceFor = (
  status: EventStatus,
  items: SourceItem[],
  definitions: Map<string, SourceDefinition>,
) => {
  const baseline: Record<EventStatus, number> = {
    RUMOR: 25,
    DEVELOPING: 50,
    REPORTED: 72,
    CONFIRMED: 90,
    OFFICIAL: 100,
  };
  const trustedOriginals = [...uniqueOriginalReports(items)].filter((originalId) => {
    const item = items.find(
      (candidate) =>
        (candidate.originalSourceId ?? candidate.reportedBy ?? candidate.sourceId) === originalId,
    );
    return item && (definitions.get(item.sourceId)?.trustScore ?? 0) >= 85;
  }).length;
  return Math.min(100, baseline[status] + Math.max(0, trustedOriginals - 1) * 2);
};

export const freshnessFor = (updatedAt: string, now = Date.now()) => {
  const hoursOld = Math.max(0, (now - new Date(updatedAt).getTime()) / 3_600_000);
  return Math.max(0, Math.round(100 - hoursOld * 2));
};

export const calculateHuddleScore = (
  scores: {
    importance: number;
    teamRelevance: number;
    freshness: number;
    fanInterest: number;
    confidence: number;
  },
  weights: HuddleWeights = DEFAULT_HUDDLE_WEIGHTS,
) =>
  Number(
    (
      scores.importance * weights.importance +
      scores.teamRelevance * weights.teamRelevance +
      scores.freshness * weights.freshness +
      scores.fanInterest * weights.fanInterest +
      scores.confidence * weights.confidence
    ).toFixed(2),
  );

export const isStatusAtLeast = (status: EventStatus, minimum: EventStatus) =>
  statusRank[status] >= statusRank[minimum];
