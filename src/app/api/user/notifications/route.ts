import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import {
  listInbox,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsSeen,
} from '@/server/notifications/repository';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('read'), notificationId: z.string().uuid() }),
  z.object({ action: z.literal('read-all') }),
  z.object({ action: z.literal('seen') }),
]);

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const cursorValue = request.nextUrl.searchParams.get('cursor');
  const cursor = cursorValue ? new Date(cursorValue) : null;
  if (cursor && Number.isNaN(cursor.getTime())) return authError('Invalid cursor.');
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20);
  const notifications = await listInbox(user.id, {
    limit: Number.isFinite(limit) ? limit : 20,
    cursor,
    unreadOnly: request.nextUrl.searchParams.get('filter') === 'unread',
    teamAbbr: request.nextUrl.searchParams.get('team'),
  });
  return NextResponse.json({
    ok: true,
    notifications,
    nextCursor:
      notifications.length === Math.min(50, Math.max(1, limit || 20))
        ? notifications.at(-1)?.createdAt.toISOString()
        : null,
  });
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const input = actionSchema.parse(await request.json());
    if (input.action === 'read') await markNotificationRead(user.id, input.notificationId);
    else if (input.action === 'read-all') await markAllNotificationsRead(user.id);
    else await markNotificationsSeen(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return authError('Unable to update notifications.');
  }
}
