import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { sendPush } from '@/server/notifications/push';
import { claimWebPushTest } from '@/server/notifications/web-push-repository';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const input = z.object({ tokenId: z.string().uuid() }).safeParse(await request.json());
    if (!input.success) return authError('Invalid subscription.', 400);
    if (!(await claimWebPushTest(user.id)))
      return authError('Wait 30 seconds before sending another test.', 429);
    const result = await sendPush({
      userId: user.id,
      title: 'Down & Distance',
      body: 'Push notifications are working. 🏈',
      destination: '/',
      webTokenId: input.data.tokenId,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch {
    return authError('Unable to send test notification.', 500);
  }
}
