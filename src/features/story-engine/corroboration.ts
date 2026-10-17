import type { ContentCandidate, RegisteredSource } from './types';

export type StoryEvidence = {
  candidate: ContentCandidate;
  source: RegisteredSource;
  supportType?: 'SUPPORTS' | 'CONTRADICTS' | 'CORRECTS' | 'OFFICIAL_CONFIRMATION';
};

const publisherSuffix = /(?:[_-](?:RSS|WEB|X|YT|YOUTUBE|API|ATOM|FEED))$/i;
// Explicit existing KC catalog ownership pairs. Keep web/social aliases together
// while preferring host identity for unrelated legacy IDs from the same website.
const legacyPublishers: Record<string, string> = {
  ARROWHEAD_ADDICT: 'arrowheadaddict.com',
  ARROWHEAD_PRIDE: 'arrowheadpride.com',
  YAHOO_SPORTS: 'sports.yahoo.com',
  CHIEFS_OFFICIAL: 'chiefs.com',
  LOCKED_ON_CHIEFS: 'locked-on-chiefs',
  RGR_FOOTBALL: 'rgr-football',
  HOW_BOUT_CHIEFS: 'how-bout-those-chiefs',
  ALL_CHIEFS_UP: 'all-chiefd-up',
};

export function publisherKey(source: RegisteredSource) {
  const configured = source.metadata.publisherId ?? source.metadata.publisherKey;
  if (typeof configured === 'string' && configured.trim()) return configured.trim().toLowerCase();
  const legacy = legacyPublishers[source.id.replace(publisherSuffix, '')];
  if (legacy) return legacy;
  try {
    const url = new URL(source.url);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (['x.com', 'twitter.com'].includes(host))
      return `x.com/${url.pathname.split('/')[1].toLowerCase()}`;
    // Social hosts contain many unrelated publishers. Explicit publisherId remains
    // the way to connect a publication's social and website identities.
    if (['youtube.com', 'youtu.be', 'reddit.com'].includes(host))
      return `${host}${url.pathname.toLowerCase().replace(/\/$/, '')}`;
    return host;
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
