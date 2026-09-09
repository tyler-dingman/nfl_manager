import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import { surfaceNextFrontOfficeEvent } from '@/server/front-office/events-repository';

const schema = z.object({ saveId: z.string().min(1).max(160) });
export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const { saveId } = schema.parse(await request.json());
  return NextResponse.json({ ok: true, event: await surfaceNextFrontOfficeEvent(user.id, saveId) });
}
