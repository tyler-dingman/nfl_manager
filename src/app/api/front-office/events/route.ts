import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import {
  listFrontOfficeEvents,
  frontOfficeNewsCounts,
  markAllFrontOfficeEventsRead,
  countUnreadFrontOfficeNews,
} from '@/server/front-office/events-repository';
import { z } from 'zod';
import { getFrontOfficeSaveMetadata } from '@/server/front-office/repository';

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const saveId = request.nextUrl.searchParams.get('saveId');
    if (!saveId) return NextResponse.json({ error: 'saveId is required.' }, { status: 400 });
    const unreadOnly = request.nextUrl.searchParams.get('unread') === '1';
    const save = await getFrontOfficeSaveMetadata(user.id, saveId);
    if (!save) return NextResponse.json({ error: 'Save not found.' }, { status: 404 });
    const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset')) || 0);
    const limit = Math.min(
      60,
      Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 60),
    );
    const events = await listFrontOfficeEvents(
      user.id,
      saveId,
      unreadOnly,
      offset,
      request.nextUrl.searchParams.get('notifications') === '1',
      {
        limit,
        team: save.teamAbbr,
        filter: request.nextUrl.searchParams.get('filter') ?? 'all',
        query: (request.nextUrl.searchParams.get('q') ?? '').slice(0, 200),
        category: request.nextUrl.searchParams.get('category') ?? '',
      },
    );
    const unreadCount = await countUnreadFrontOfficeNews(user.id, saveId);
    return NextResponse.json({
      ok: true,
      events,
      unreadCount,
      counts: await frontOfficeNewsCounts(user.id, saveId, save.teamAbbr),
      nextOffset: events.length === limit ? offset + events.length : null,
    });
  } catch (error) {
    console.error('[front-office:events:GET]', error);
    return NextResponse.json(
      { error: 'Unable to load Front Office news. Please try again.' },
      { status: 500 },
    );
  }
}

const patchSchema = z.object({
  saveId: z.string().min(1).max(160),
  action: z.literal('read-all'),
});

export async function PATCH(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const { saveId } = patchSchema.parse(await request.json());
  const save = await getFrontOfficeSaveMetadata(user.id, saveId);
  if (!save) return NextResponse.json({ error: 'Save not found.' }, { status: 404 });
  await markAllFrontOfficeEventsRead(user.id, saveId);
  return NextResponse.json({ ok: true });
}
