import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/server/auth/request';
import { assertSameOrigin } from '@/server/auth/http';
import {
  createTransferService,
  transferEnabled,
  TransferError,
} from '@/server/providers/unabated/transfer-service';
export const runtime = 'nodejs';
export const maxDuration = 30;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  return reply({ enabled: !!user && transferEnabled(user.id) });
}
const input = z.union([
  z
    .object({
      action: z.literal('start'),
      ids: z
        .array(z.string().uuid())
        .min(1)
        .max(20)
        .refine((v) => new Set(v).size === v.length),
    })
    .strict(),
  z.object({ action: z.literal('poll'), id: z.string().uuid() }).strict(),
]);
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return reply({ error: 'Sign in to prepare a FanDuel slip.' }, 401);
    if (!transferEnabled(user.id))
      return reply({ error: 'FanDuel transfers are not enabled for this account.' }, 403);
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: 'Invalid transfer request.' }, 400);
    const body = input.safeParse(JSON.parse(raw));
    if (!body.success) return reply({ error: 'Invalid selections.' }, 400);
    const service = createTransferService();
    return reply(
      body.data.action === 'start'
        ? await service.start(user.id, body.data.ids)
        : await service.poll(user.id, body.data.id),
    );
  } catch (e) {
    return reply(
      {
        error:
          e instanceof TransferError
            ? e.message
            : 'Unable to prepare this FanDuel slip. Your parlay has been preserved.',
      },
      e instanceof TransferError ? e.status : 400,
    );
  }
}
