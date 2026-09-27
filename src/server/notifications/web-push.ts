import webpush from 'web-push';
import { z } from 'zod';

// Accept only browser push services, never arbitrary URLs supplied by clients (SSRF).
export function isPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'fcm.googleapis.com' ||
        url.hostname === 'updates.push.services.mozilla.com' ||
        url.hostname.endsWith('.push.services.mozilla.com') ||
        url.hostname === 'web.push.apple.com' ||
        url.hostname.endsWith('.notify.windows.com'))
    );
  } catch {
    return false;
  }
}

export const webSubscriptionSchema = z.object({
  endpoint: z.string().max(4096).refine(isPushEndpoint, 'Unsupported push service.'),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z
      .string()
      .regex(/^[A-Za-z0-9_-]{87}=?$/)
      .refine((value) => Buffer.from(value, 'base64url')[0] === 4),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}(==)?$/),
  }),
});
export type WebSubscription = z.infer<typeof webSubscriptionSchema>;

export function vapidConfig() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export async function deliverWebPush(
  token: string,
  message: { title: string; body: string; destination: string },
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(token);
  } catch {
    throw Object.assign(new Error('Invalid subscription'), { statusCode: 410 });
  }
  const subscription = webSubscriptionSchema.safeParse(parsed);
  if (!subscription.success)
    throw Object.assign(new Error('Invalid subscription'), { statusCode: 410 });
  if (subscription.data.expirationTime && subscription.data.expirationTime <= Date.now())
    throw Object.assign(new Error('Expired subscription'), { statusCode: 410 });
  const config = vapidConfig();
  if (!config) throw new Error('WEB_PUSH_NOT_CONFIGURED');
  return webpush.sendNotification(
    subscription.data,
    JSON.stringify({ title: message.title, body: message.body, destination: message.destination }),
    {
      vapidDetails: config,
      TTL: 3600,
      timeout: 10000,
    },
  );
}

export function expiredWebPush(error: unknown) {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return status === 404 || status === 410;
}
