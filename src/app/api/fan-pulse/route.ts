import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { FAN_PULSE_REACTIONS } from '@/features/fan-pulse/model';
import { currentUser } from '@/server/auth/request';
import { getFanPulse, setFanPulseReaction } from '@/server/fan-pulse/repository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const contentId = request.nextUrl.searchParams.get('contentId')?.trim();
  if (!contentId) return NextResponse.json({ error: 'contentId is required.' }, { status: 400 });
  const user = await currentUser(request);
  return NextResponse.json({ ok: true, pulse: await getFanPulse(contentId, user?.id) });
}

const inputSchema = z.object({
  contentId: z.string().min(1).max(300),
  teamId: z.string().min(2).max(8),
  reaction: z.enum(FAN_PULSE_REACTIONS),
});

export async function PUT(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in to save your reaction.' }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid reaction.' }, { status: 400 });
  const pulse = await setFanPulseReaction({ userId: user.id, ...parsed.data });
  return NextResponse.json({ ok: true, pulse });
}
