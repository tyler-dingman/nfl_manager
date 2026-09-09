import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import { listFrontOfficeEvents } from '@/server/front-office/events-repository';

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const saveId = request.nextUrl.searchParams.get('saveId');
  if (!saveId) return NextResponse.json({ error: 'saveId is required.' }, { status: 400 });
  const unreadOnly = request.nextUrl.searchParams.get('unread') === '1';
  const events = await listFrontOfficeEvents(user.id, saveId, unreadOnly);
  return NextResponse.json({ ok: true, events, unreadCount: events.filter((event) => !event.readAt).length });
}
