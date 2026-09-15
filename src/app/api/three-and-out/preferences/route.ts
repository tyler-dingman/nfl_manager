import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import {
  getDeliveryReadiness,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/server/notifications/repository';

const CATEGORY = 'THREE_AND_OUT_DAILY';
const schema = z.object({
  enabled: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
});

const responseFor = async (user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) => {
  const [rows, readiness] = await Promise.all([
    getNotificationPreferences(user.id),
    getDeliveryReadiness(user.id),
  ]);
  const values = Object.fromEntries(
    rows.filter((row) => row.category === CATEGORY).map((row) => [row.channel, row.enabled]),
  );
  return {
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
    await Promise.all(
      [
        ['IN_APP', input.enabled],
        ['EMAIL', input.email],
        ['SMS', input.sms],
        ['PUSH', input.push],
      ].map(([channel, enabled]) =>
        updateNotificationPreferences(user.id, {
          topicType: 'CONTENT',
          topicId: 'THREE_AND_OUT',
          category: CATEGORY,
          channel: channel as 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH',
          enabled: Boolean(enabled),
        }),
      ),
    );
    return NextResponse.json({ ok: true, preferences: await responseFor(user) });
  } catch {
    return authError('Unable to save Three & Out preferences.');
  }
}
