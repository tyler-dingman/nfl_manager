import type { NotificationThresholds } from './types';

export const MONITORING_THRESHOLDS: NotificationThresholds = {
  indexOnlyMax: Number(process.env.MONITOR_INDEX_ONLY_MAX ?? 44),
  feedOnlyMax: Number(process.env.MONITOR_FEED_ONLY_MAX ?? 64),
  candidateNotificationMin: Number(process.env.MONITOR_CANDIDATE_NOTIFICATION_MIN ?? 65),
  pushNotificationMin: Number(process.env.MONITOR_PUSH_NOTIFICATION_MIN ?? 80),
  breakingNotificationMin: Number(process.env.MONITOR_BREAKING_NOTIFICATION_MIN ?? 90),
};

export const isObserverMode = () => process.env.OBSERVER_MODE === 'true';
