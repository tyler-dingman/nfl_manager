import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { upsertPushToken } from '@/server/notifications/repository';

const schema = z.object({
  deviceId: z.string().uuid(),
  provider: z.enum(['APNS', 'FCM', 'WEB_PUSH', 'EXPO']),
  token: z.string().min(20).max(4096),
});

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    const token = await upsertPushToken(user.id, input.deviceId, input.provider, input.token);
    if (!token) return NextResponse.json({ error: 'Device was not found or is disabled.' }, { status: 404 });
    return NextResponse.json({ ok: true, tokenId: token.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unable to register push token.' }, { status: 400 });
  }
}
