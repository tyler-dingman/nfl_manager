import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { listContentState, upsertContentState } from '@/server/user/content-repository';

const contentType = z.enum(['STORY', 'THREE_AND_OUT', 'AUDIO', 'VIDEO', 'PODCAST', 'OTHER']);
const stateSchema = z.object({
  contentType,
  contentId: z.string().min(1).max(300),
  mediaVersion: z.string().max(200).nullable().optional(),
  progressSeconds: z.number().min(0).nullable().optional(),
  durationSeconds: z.number().positive().nullable().optional(),
  completed: z.boolean().optional(),
  viewed: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const ids = request.nextUrl.searchParams.get('contentIds')?.split(',').filter(Boolean);
  return NextResponse.json({ ok: true, state: await listContentState(user.id, ids) });
}

export async function PUT(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  try {
    assertSameOrigin(request);
    const input = stateSchema.parse(await request.json());
    return NextResponse.json({ ok: true, state: await upsertContentState(user.id, input) });
  } catch {
    return NextResponse.json({ error: 'Invalid content state.' }, { status: 400 });
  }
}