import { deliverWebPush, expiredWebPush } from './web-push';
import { deleteWebPushToken } from './web-push-repository';
import { randomUUID } from 'node:crypto';
import { getPreferences } from '@/server/user/repository';
import {
  createNotification,
  finishPushDelivery,
  invalidatePushToken,
  listDeliverablePushTokens,
  recordDelivery,
} from './repository';

export type PushMessage = {
  userId: string;
  title: string;
  body: string;
  destination: string;
  eventId?: string;
  data?: Record<string, unknown>;
  webTokenId?: string;
};
type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

const defaultDependencies = {
  getPreferences,
  listDeliverablePushTokens,
  createNotification,
  finishPushDelivery,
  recordDelivery,
  invalidatePushToken,
  deleteWebPushToken,
  deliverWebPush,
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
};

export async function sendPush(input: PushMessage, dependencies = defaultDependencies) {
  const {
    getPreferences,
    listDeliverablePushTokens,
    createNotification,
    finishPushDelivery,
    recordDelivery,
    invalidatePushToken,
    deleteWebPushToken,
    deliverWebPush,
    fetch,
  } = dependencies;
  const preferences = await getPreferences(input.userId);
  if (preferences?.pushEnabled === false)
    return {
      ok: false,
      suppressed: true,
      reason: 'Push notifications are disabled.',
      delivered: 0,
    };
  const tokens = (await listDeliverablePushTokens(input.userId)).filter((token) =>
    input.webTokenId
      ? token.provider === 'WEB_PUSH' && token.id === input.webTokenId
      : token.provider === 'EXPO' || token.provider === 'WEB_PUSH',
  );
  if (!tokens.length)
    return { ok: false, reason: 'No enabled device with a valid push subscription.', delivered: 0 };
  const notification = await createNotification(input.userId, {
    eventId: input.eventId ?? `push:${randomUUID()}`,
    title: input.title,
    body: input.body,
    deepLink: input.destination,
    pushEligible: true,
  });
  if (!notification) throw new Error('Unable to create notification record.');
  let delivered = 0;
  const failures: string[] = [];
  for (const registered of tokens) {
    if (registered.provider === 'WEB_PUSH') {
      try {
        await deliverWebPush(registered.token, input);
        await recordDelivery(notification.id, 'PUSH', 'WEB_PUSH', 'SENT', registered.deviceId);
        delivered += 1;
      } catch (error) {
        if (expiredWebPush(error)) await deleteWebPushToken(input.userId, registered.id);
        const status = (error as { statusCode?: number })?.statusCode;
        const code = status ? `WEB_PUSH_HTTP_${status}` : 'WEB_PUSH_PROVIDER_ERROR';
        await recordDelivery(
          notification.id,
          'PUSH',
          'WEB_PUSH',
          'FAILED',
          registered.deviceId,
          code,
        );
        failures.push(code);
      }
      continue;
    }
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          to: registered.token,
          title: input.title,
          body: input.body,
          sound: 'default',
          data: { destination: input.destination, ...input.data },
        }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: ExpoTicket } | null;
      const ticket = payload?.data;
      if (!response.ok || !ticket || ticket.status === 'error') {
        const code =
          ticket && ticket.status === 'error'
            ? (ticket.details?.error ?? ticket.message)
            : `HTTP_${response.status}`;
        if (code === 'DeviceNotRegistered') await invalidatePushToken(input.userId, registered.id);
        await recordDelivery(notification.id, 'PUSH', 'EXPO', 'FAILED', registered.deviceId, code);
        failures.push(code);
        continue;
      }
      await recordDelivery(notification.id, 'PUSH', 'EXPO', 'SENT', registered.deviceId);
      delivered += 1;
    } catch (error) {
      const code = error instanceof Error ? error.message : 'EXPO_PROVIDER_ERROR';
      await recordDelivery(
        notification.id,
        'PUSH',
        'EXPO',
        'FAILED',
        registered.deviceId,
        code.slice(0, 120),
      );
      failures.push(code);
    }
  }
  await finishPushDelivery(notification.id, delivered);
  return { ok: delivered > 0, delivered, failed: failures.length, failures };
}
