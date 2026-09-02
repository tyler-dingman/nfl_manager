import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getNotificationPreferences, updateNotificationPreferences } from '@/server/notifications/repository';

const preferencesSchema = z.object({
  topicType: z.string().max(32).nullable().optional(),
  topicId: z.string().max(64).nullable().optional(),
  category: z.string().min(1).max(64),
  channel: z.enum(['PUSH', 'SMS', 'EMAIL', 'IN_APP']),
  enabled: z.boolean(),
  minimumPriority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
});

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  return NextResponse.json({ ok: true, preferences: await getNotificationPreferences(user.id) });
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);

    const input = preferencesSchema.parse(await request.json());
    const preference = await updateNotificationPreferences(user.id, input);
    return NextResponse.json({ ok: true, preference });
  } catch {
    return authError('Unable to save notification preferences.');
  }
}
