import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { authDb } from '@/server/auth/database';
import {
  DEFAULT_DELIVERY_TIME,
  validDeliveryTime,
  validTimezone,
} from '../../../../../packages/three-and-out/schedule';

import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import {
  getDeliveryReadiness,
  getNotificationPreferences,
} from '@/server/notifications/repository';

const CATEGORY = 'THREE_AND_OUT_DAILY';
const schema = z.object({
  enabled: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
  deliveryTime: z.string().refine(validDeliveryTime).optional(),
  timezone: z.string().max(100).refine(validTimezone).optional(),
});

const responseFor = async (user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) => {
  const [rows, readiness] = await Promise.all([
    getNotificationPreferences(user.id),
    getDeliveryReadiness(user.id),
  ]);
  const values = Object.fromEntries(
    rows.filter((row) => row.category === CATEGORY).map((row) => [row.channel, row.enabled]),
  );
  const master = rows.find(
    (row) =>
      row.category === CATEGORY && row.channel === 'IN_APP' && row.topicId === 'THREE_AND_OUT',
  );
  const profiles = await authDb()<
    { timezone: string }[]
  >`SELECT timezone FROM user_profiles WHERE user_id=${user.id}`;
  const timezone = master?.deliveryTimezone ?? profiles[0]?.timezone;
  return {
    deliveryTime: master?.deliveryTime ?? DEFAULT_DELIVERY_TIME,
    timezone: timezone && validTimezone(timezone) ? timezone : null,
    enabled: values.IN_APP ?? false,
    email: values.EMAIL ?? false,
    sms: values.SMS ?? false,
    push: values.PUSH ?? false,
    accountEmail: user.primaryEmail ?? null,
    emailAvailable: Boolean(user.primaryEmail),
    ...readiness,
    smsDeliveryPending: true,
  };
};

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  return NextResponse.json({ ok: true, preferences: await responseFor(user) });
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const input = schema.parse(await request.json());
    await authDb().begin(async (sql) => {
      for (const [channel, enabled] of [
        ['IN_APP', input.enabled],
        ['EMAIL', input.email],
        ['SMS', input.sms],
        ['PUSH', input.push],
      ] as const) {
        await sql`INSERT INTO user_notification_preferences
          (id,user_id,topic_type,topic_id,category,channel,enabled,delivery_time,delivery_timezone)
          VALUES (${randomUUID()},${user.id},'CONTENT','THREE_AND_OUT',${CATEGORY},${channel},${enabled},
            ${channel === 'IN_APP' ? (input.deliveryTime ?? DEFAULT_DELIVERY_TIME) : null},
            ${channel === 'IN_APP' ? (input.timezone ?? null) : null})
          ON CONFLICT(user_id,topic_type,topic_id,category,channel) DO UPDATE SET
            enabled=EXCLUDED.enabled,updated_at=now(),
            delivery_time=CASE WHEN ${channel === 'IN_APP' && input.deliveryTime !== undefined} THEN EXCLUDED.delivery_time ELSE user_notification_preferences.delivery_time END,
            delivery_timezone=CASE WHEN ${channel === 'IN_APP' && input.timezone !== undefined} THEN EXCLUDED.delivery_timezone ELSE user_notification_preferences.delivery_timezone END`;
      }
    });
    return NextResponse.json({ ok: true, preferences: await responseFor(user) });
  } catch {
    return authError('Unable to save Three & Out preferences.');
  }
}
