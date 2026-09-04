export type MonitoringTier = 1 | 2 | 3;
export type MonitoringPlatform = 'WEB' | 'RSS' | 'X' | 'YOUTUBE' | 'REDDIT';
export type IngestionMethod =
  | 'RSS_ATOM'
  | 'YOUTUBE_WEBSUB'
  | 'X_API'
  | 'REDDIT_API'
  | 'PUBLIC_PAGE';
export type SourceAvailability = 'LIVE' | 'CONFIGURED_BUT_UNAVAILABLE';

export type MonitoringSource = {
  id: string;
  teamId: string;
  name: string;
  tier: MonitoringTier;
  platform: MonitoringPlatform;
  canonicalUrl: string;
  ingestionMethod: IngestionMethod;
  deliveryStrategy: 'POLL' | 'WEBHOOK' | 'STREAM';
  cadenceSeconds: number | null;
  authorityWeight: number;
  active: boolean;
  notificationEligible: boolean;
  requiredEnvironment: string[];
  availability: SourceAvailability;
  metadata: Record<string, string | number | boolean | null>;
};

export type NotificationThresholds = {
  indexOnlyMax: number;
  feedOnlyMax: number;
  candidateNotificationMin: number;
  pushNotificationMin: number;
  breakingNotificationMin: number;
};

export type ObserverDecision = {
  decision: 'PUSH' | 'CANDIDATE' | 'FEED_ONLY' | 'INDEX_ONLY' | 'SUPPRESSED';
  reason: string;
};
