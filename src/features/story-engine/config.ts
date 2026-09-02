import type { PollingTier, RegisteredSource } from './types';

export const POLLING_TIERS: Record<PollingTier, number> = {
  A: Number(process.env.SOURCE_TIER_A_SECONDS ?? 180),
  B: Number(process.env.SOURCE_TIER_B_SECONDS ?? 600),
  C: Number(process.env.SOURCE_TIER_C_SECONDS ?? 1800),
};
export const SOURCE_POLLING_TIERS = {
  BREAKING: Number(
    process.env.SOURCE_TIER_BREAKING_SECONDS ?? process.env.SOURCE_TIER_A_SECONDS ?? 180,
  ),
  STANDARD: Number(
    process.env.SOURCE_TIER_STANDARD_SECONDS ?? process.env.SOURCE_TIER_B_SECONDS ?? 600,
  ),
  LONG_FORM: Number(
    process.env.SOURCE_TIER_LONG_FORM_SECONDS ?? process.env.SOURCE_TIER_C_SECONDS ?? 1800,
  ),
} as const;
export type SourcePollingClass = keyof typeof SOURCE_POLLING_TIERS;
export function pollingIntervalSeconds(tier: SourcePollingClass, overrideSeconds?: number | null) {
  return overrideSeconds && overrideSeconds >= 60 ? overrideSeconds : SOURCE_POLLING_TIERS[tier];
}
const SOURCE_CLASS_BY_TIER: Record<PollingTier, SourcePollingClass> = {
  A: 'BREAKING',
  B: 'STANDARD',
  C: 'LONG_FORM',
};
const LEGACY_DEFAULT_BY_TIER: Record<PollingTier, number> = { A: 180, B: 600, C: 1800 };
export function registeredSourceIntervalSeconds(
  source: Pick<RegisteredSource, 'pollingTier' | 'checkIntervalSeconds'>,
) {
  const override =
    source.checkIntervalSeconds !== LEGACY_DEFAULT_BY_TIER[source.pollingTier]
      ? source.checkIntervalSeconds
      : null;
  return pollingIntervalSeconds(SOURCE_CLASS_BY_TIER[source.pollingTier], override);
}

export const STORY_ENGINE_THRESHOLDS = {
  merge: 0.72,
  ambiguous: 0.52,
  material: 0.58,
  autoPublishConfidence: 90,
  importanceChange: 10,
  breakingImportance: Number(process.env.STORY_BREAKING_IMPORTANCE ?? 85),
} as const;

export const SOURCE_FETCH_TIMEOUT_MS = Number(process.env.SOURCE_FETCH_TIMEOUT_MS ?? 10_000);
export const SOURCE_BATCH_SIZE = Number(process.env.SOURCE_BATCH_SIZE ?? 10);
export const MAX_FAILURE_BACKOFF_SECONDS = 6 * 60 * 60;

export function nextCheckAfterSuccess(intervalSeconds: number, now = new Date()) {
  return new Date(now.getTime() + intervalSeconds * 1000);
}

export function nextCheckAfterFailure(
  intervalSeconds: number,
  failureCount: number,
  now = new Date(),
) {
  const seconds = Math.min(
    MAX_FAILURE_BACKOFF_SECONDS,
    intervalSeconds * 2 ** Math.min(20, failureCount),
  );
  return new Date(now.getTime() + seconds * 1000);
}
