import { NextRequest, NextResponse } from 'next/server';

import { currentUser } from '@/server/auth/request';
import { unreadNotificationCount } from '@/server/notifications/repository';

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ count: 0, authenticated: false });
  const teamAbbr = request.nextUrl.searchParams.get('team')?.toUpperCase() ?? null;
  return NextResponse.json({
    count: await unreadNotificationCount(user.id, teamAbbr),
    authenticated: true,
  });
}
