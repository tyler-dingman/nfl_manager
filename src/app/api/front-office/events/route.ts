import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import {
  listFrontOfficeEvents,
  markAllFrontOfficeEventsRead,
  persistFrontOfficeEvents,
} from '@/server/front-office/events-repository';
import { z } from 'zod';
import { getFrontOfficeSaveMetadata } from '@/server/front-office/repository';
import { realWorldSeedEvents } from '@/server/front-office/real-world-seed';
import { getSaveStateResult } from '@/server/api/store';
import { buildWeekOneWelcomeEvents } from '@/server/front-office/welcome-messages';

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const saveId = request.nextUrl.searchParams.get('saveId');
  if (!saveId) return NextResponse.json({ error: 'saveId is required.' }, { status: 400 });
  const unreadOnly = request.nextUrl.searchParams.get('unread') === '1';
  const save = await getFrontOfficeSaveMetadata(user.id, saveId);
  if (!save) return NextResponse.json({ error: 'Save not found.' }, { status: 404 });
  await persistFrontOfficeEvents(user.id, realWorldSeedEvents(saveId, save.season));
  const saveState = getSaveStateResult(saveId);
  await persistFrontOfficeEvents(
    user.id,
    buildWeekOneWelcomeEvents(save, saveState.ok ? saveState.data.roster : []),
  );
  const events = await listFrontOfficeEvents(user.id, saveId, unreadOnly);
  return NextResponse.json({
    ok: true,
    events,
    unreadCount: events.filter((event) => !event.readAt).length,
  });
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
