import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { addMessage, predict, react, simulate } from '@/server/game-day/repository';
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('MESSAGE'), body: z.string().trim().min(1).max(500) }),
  z.object({
    action: z.literal('SHARE'),
    body: z.string().trim().min(1).max(200),
    payload: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal('REACTION'),
    activityId: z.string().uuid(),
    reaction: z.enum(['🔥', '😂', '😤', '🤦', '🍺', '👀', 'FIRST DOWN', "THAT'S SIX"]),
  }),
  z.object({
    action: z.literal('PREDICT'),
    kind: z.enum(['PREGAME', 'DRIVE']),
    prompt: z.string().min(1).max(100),
    selection: z.string().min(1).max(50),
  }),
  z.object({
    action: z.literal('SIMULATE'),
    simulation: z.enum([
      'START_TAILGATE',
      'KICKOFF',
      'START_DRIVE',
      'FIRST_DOWN',
      'BIG_PLAY',
      'TOUCHDOWN_HOME',
      'FIELD_GOAL_HOME',
      'TURNOVER_HOME',
      'TOUCHDOWN_AWAY',
      'INJURY',
      'HALFTIME',
      'START_3Q',
      'FINAL',
    ]),
  }),
]);
export async function POST(r: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    const b = schema.parse(await r.json());
    if (b.action === 'MESSAGE') await addMessage(u.id, params.roomId, b.body);
    if (b.action === 'SHARE')
      await addMessage(u.id, params.roomId, b.body, 'SHARED_CONTENT', b.payload);
    if (b.action === 'REACTION') await react(u.id, params.roomId, b.activityId, b.reaction);
    if (b.action === 'PREDICT') await predict(u.id, params.roomId, b.kind, b.prompt, b.selection);
    if (b.action === 'SIMULATE') await simulate(u.id, params.roomId, b.simulation);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authError((e as Error).message);
  }
}
