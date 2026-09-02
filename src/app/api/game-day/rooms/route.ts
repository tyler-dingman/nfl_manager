import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { activeRoom, createRoom, joinRoom } from '@/server/game-day/repository';
export async function GET(r: NextRequest) {
  const u = await currentUser(r);
  if (!u) return authError('Unauthorized.', 401);
  return NextResponse.json({
    room: await activeRoom(u.id, r.nextUrl.searchParams.get('team')?.toUpperCase()),
  });
}
export async function POST(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    const b = z
      .discriminatedUnion('action', [
        z.object({
          action: z.literal('CREATE'),
          teamId: z
            .string()
            .min(2)
            .max(4)
            .transform((v) => v.toUpperCase()),
        }),
        z.object({ action: z.literal('JOIN'), code: z.string().min(6).max(64) }),
      ])
      .parse(await r.json());
    return NextResponse.json(
      b.action === 'CREATE' ? await createRoom(u.id, b.teamId) : await joinRoom(u.id, b.code),
      { status: 201 },
    );
  } catch (e) {
    return authError((e as Error).message);
  }
}
