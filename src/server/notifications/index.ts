export const NOTIFICATION_EVENT_TYPES = [
  'BREAKING_STORY',
  'STORY_UPDATED',
  'STORY_ENTERED_THREE_AND_OUT',
  'THREE_AND_OUT_UPDATED',
  'THREE_AND_OUT_AUDIO_READY',
  'THREE_AND_OUT_VIDEO_READY',
  'PLAYER_NEWS',
  'PLAYER_INJURY_UPDATE',
  'GAME_STARTING_SOON',
  'GAME_FINAL',
  'FOURTH_DOWN_POLL',
  'PREDICTION_RESULT',
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type DevicePlatform = 'IOS' | 'ANDROID' | 'WEB';
export type NotificationChannel = 'PUSH' | 'SMS' | 'EMAIL' | 'IN_APP';
export type NotificationIntensity = 'CASUAL' | 'LOCKED_IN' | 'SICKO';

export type NotificationEvent = {
  id: string;
  type: NotificationEventType;
  teamId?: string;
  playerId?: string;
  storyId?: string;
  priority?: NotificationPriority;
  title: string;
  body: string;
  deepLink?: string;
  imageUrl?: string | null;
  createdAt: string;
};

export type QuietHours = {
  enabled: boolean;
  startLocalTime: string;
  endLocalTime: string;
  timezone: string;
  allowBreakingOverride: boolean;
};

export type NotificationAudienceTarget = {
  userId: string;
  intensity: NotificationIntensity;
  teamFollows: string[];
  quietHours?: QuietHours;
};

export type NotificationAudienceResult = {
  userId: string;
  intensity: NotificationIntensity;
  priority: NotificationPriority;
  quietHours?: QuietHours;
};

export function normalizePriority(priority: NotificationPriority | string = 'NORMAL'): NotificationPriority {
  switch (priority) {
    case 'LOW':
    case 'NORMAL':
    case 'HIGH':
    case 'CRITICAL':
      return priority;
    default:
      return 'NORMAL';
  }
}

export function buildDedupeKey(
  type: NotificationEventType | string,
  scope: string,
  priority: NotificationPriority | string = 'NORMAL',
) {
  return `${type}:${scope}:${normalizePriority(priority)}`;
}

export function resolveAudienceForEvent(
  event: NotificationEvent,
  targets: NotificationAudienceTarget[],
): NotificationAudienceResult[] {
  const priority = normalizePriority(event.priority ?? 'NORMAL');
  return targets
    .filter(({ teamFollows }) => {
      if (event.teamId && teamFollows.includes(event.teamId)) return true;
      return false;
    })
    .map((target) => ({
      userId: target.userId,
      intensity: target.intensity,
      priority,
      quietHours: target.quietHours,
    }));
}

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

export function isQuietHour(
  quietHours: QuietHours,
  isoDate: string,
  priority?: NotificationPriority | string,
) {
  if (!quietHours.enabled) return false;
  const normalizedPriority = priority ? normalizePriority(priority) : 'NORMAL';
  if (
    quietHours.allowBreakingOverride &&
    ['HIGH', 'CRITICAL'].includes(normalizedPriority)
  ) {
    return false;
  }

  const date = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: quietHours.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const currentMinutes = Number(parts.hour ?? 0) * 60 + Number(parts.minute ?? 0);
  const startMinutes = parseTimeToMinutes(quietHours.startLocalTime);
  const endMinutes = parseTimeToMinutes(quietHours.endLocalTime);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export interface PushProviderAdapter {
  send(input: { userId: string; token: string; title: string; body: string; deepLink?: string }): Promise<{ ok: boolean; id?: string }>; 
  sendBatch(input: Array<{ userId: string; token: string; title: string; body: string; deepLink?: string }>): Promise<{ ok: boolean; delivered: number; failed: number }>;
}

export class PushProvider implements PushProviderAdapter {
  async send() {
    return { ok: true, id: 'mock-push-id' };
  }

  async sendBatch(items: Array<{ userId: string; token: string; title: string; body: string; deepLink?: string }>) {
    return {
      ok: true,
      delivered: items.length,
      failed: 0,
    };
  }
}

export const notificationDefaults = {
  CASUAL: {
    breaking: true,
    threeAndOut: false,
    playerNews: false,
  },
  LOCKED_IN: {
    breaking: true,
    threeAndOut: true,
    playerNews: true,
  },
  SICKO: {
    breaking: true,
    threeAndOut: true,
    playerNews: true,
    rosterMoves: true,
    practiceNews: true,
  },
} as const;
