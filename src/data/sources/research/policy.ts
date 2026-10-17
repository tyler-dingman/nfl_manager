/** Research identity is separate from immutable production source IDs. */
export function normalizeSourceUrl(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Expected an unauthenticated HTTP source URL');
  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (['twitter.com', 'mobile.twitter.com', 'mobile.x.com'].includes(url.hostname))
    url.hostname = 'x.com';
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (/^utm_/i.test(key) || ['fbclid', 'gclid', 'ref'].includes(key))
      url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.hostname === 'x.com')
    url.pathname = url.pathname.split('/').slice(0, 2).join('/').toLowerCase();
  return url.href.replace(/\/$/, '');
}

export function sourceIdentity(value: string, aliases: ReadonlyMap<string, string> = new Map()) {
  const key = normalizeSourceUrl(value);
  return aliases.get(key) ?? key;
}

export type QualityEvidence = {
  originalReporting: number;
  reliability: number;
  teamRelevance: number;
  freshness: number;
  uniqueness: number;
  accessibility: number;
};
const maxima: QualityEvidence = {
  originalReporting: 25,
  reliability: 25,
  teamRelevance: 20,
  freshness: 15,
  uniqueness: 10,
  accessibility: 5,
};
export function qualityScore(evidence: QualityEvidence) {
  return (Object.keys(maxima) as Array<keyof QualityEvidence>).reduce((total, key) => {
    const value = evidence[key];
    if (!Number.isFinite(value) || value < 0 || value > maxima[key])
      throw new Error(`Invalid ${key} evidence score`);
    return total + value;
  }, 0);
}
export const qualityTier = (score: number) =>
  score >= 90 ? 1 : score >= 75 ? 2 : score >= 60 ? 3 : null;

export type Eligibility = {
  discoveryOnly: boolean;
  verificationStatus: string;
  canonicalFeedUrl: string | null;
  rightsStatus: 'REVIEW_REQUIRED' | 'APPROVED_METADATA';
};
export function canAutomateSource(source: Eligibility) {
  return (
    !source.discoveryOnly &&
    source.verificationStatus === 'FEED_VERIFIED' &&
    Boolean(source.canonicalFeedUrl) &&
    source.rightsStatus === 'APPROVED_METADATA'
  );
}

/** Planning only. Existing cron and source intervals are intentionally untouched. */
export function plannedIntervalSeconds(input: {
  averageDailyItems: number | null;
  consecutiveFailures: number;
  tier: number | null;
}) {
  if (input.averageDailyItems === null) return null; // Never invent a measured cadence.
  if (
    !Number.isFinite(input.averageDailyItems) ||
    input.averageDailyItems < 0 ||
    !Number.isSafeInteger(input.consecutiveFailures) ||
    input.consecutiveFailures < 0
  )
    throw new Error('Invalid source observations');
  const base = Math.max(
    input.tier === 1 ? 1800 : input.tier === 2 ? 7200 : 21600,
    Math.min(86400, 86400 / Math.max(1, input.averageDailyItems * 2)),
  );
  return Math.min(86400, Math.ceil(base * 2 ** Math.min(10, input.consecutiveFailures)));
}

export function sharedFeedPlan<
  T extends { canonicalFeedUrl: string | null; ingestionEligible: boolean; enabled: boolean },
>(sources: T[]) {
  const feeds = new Map<string, T[]>();
  for (const source of sources) {
    if (!source.enabled || !source.ingestionEligible || !source.canonicalFeedUrl) continue;
    const key = normalizeSourceUrl(source.canonicalFeedUrl);
    feeds.set(key, [...(feeds.get(key) ?? []), source]);
  }
  return feeds;
}
