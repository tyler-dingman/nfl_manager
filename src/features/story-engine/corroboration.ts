import type { ContentCandidate, RegisteredSource } from './types';

export type StoryEvidence = {
  candidate: ContentCandidate;
  source: RegisteredSource;
  supportType?: 'SUPPORTS' | 'CONTRADICTS' | 'CORRECTS' | 'OFFICIAL_CONFIRMATION';
};

const publisherSuffix = /(?:[_-](?:RSS|WEB|X|YT|YOUTUBE|API|ATOM|FEED))$/i;

export function publisherKey(source: RegisteredSource) {
  const configured = source.metadata.publisherId ?? source.metadata.publisherKey;
  if (typeof configured === 'string' && configured.trim()) return configured.trim().toLowerCase();
  if (publisherSuffix.test(source.id)) return source.id.replace(publisherSuffix, '').toLowerCase();
  try {
    return new URL(source.url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return source.id.replace(publisherSuffix, '').toLowerCase();
  }
}

export function isOfficialSource(source: RegisteredSource) {
  return ['OFFICIAL_TEAM', 'NFL_OFFICIAL'].includes(source.sourceType);
}

export function isDiscoveryOnly(source: RegisteredSource) {
  return source.pollingTier === 'C' || source.metadata.monitoringTier === 3;
}

export function evidenceCounts(evidence: StoryEvidence[]) {
  const publishers = new Set(evidence.map(({ source }) => publisherKey(source)));
  const qualifyingPublishers = new Set(
    evidence
      .filter(
        ({ source, supportType }) => !isDiscoveryOnly(source) && supportType !== 'CONTRADICTS',
      )
      .map(({ source }) => publisherKey(source)),
  );
  return {
    sourceItemCount: evidence.length,
    publisherCount: publishers.size,
    independentSourceCount: qualifyingPublishers.size,
  };
}
