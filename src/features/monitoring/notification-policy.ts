import type { MonitoringTier, NotificationThresholds, ObserverDecision } from './types';

export function evaluateObserverNotification(input: {
  score: number;
  tier: MonitoringTier;
  official: boolean;
  confirmedTransaction: boolean;
  materialUpdate: boolean;
  alreadyNotified: boolean;
  thresholds: NotificationThresholds;
}): ObserverDecision {
  const { score, tier, official, confirmedTransaction, thresholds } = input;
  if (input.alreadyNotified && !input.materialUpdate)
    return { decision: 'SUPPRESSED', reason: 'Event already notified; no material update.' };
  if (tier === 3 && !official)
    return { decision: 'INDEX_ONLY', reason: 'Tier 3 sources are discovery signals only.' };
  if (tier === 2 && !official && !confirmedTransaction)
    return score >= thresholds.candidateNotificationMin
      ? { decision: 'CANDIDATE', reason: 'Tier 2 source requires corroboration or explicit rule.' }
      : { decision: 'FEED_ONLY', reason: 'Tier 2 analysis/feed content.' };
  if (score >= thresholds.breakingNotificationMin && (official || confirmedTransaction))
    return {
      decision: 'PUSH',
      reason: official ? 'Official high-impact development.' : 'Confirmed high-impact transaction.',
    };
  if (score >= thresholds.pushNotificationMin)
    return { decision: 'PUSH', reason: 'Trusted source met the push threshold.' };
  if (score >= thresholds.candidateNotificationMin)
    return { decision: 'CANDIDATE', reason: 'Requires notification review or confirmation.' };
  if (score > thresholds.indexOnlyMax)
    return { decision: 'FEED_ONLY', reason: 'Below notification threshold.' };
  return { decision: 'INDEX_ONLY', reason: 'Low-confidence or low-impact signal.' };
}
