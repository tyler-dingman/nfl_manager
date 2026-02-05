import { NextResponse } from 'next/server';

import { signFreeAgent } from '@/server/api/players';

export const POST = async (request: Request) => {
  const body = (await request.json()) as { saveId?: string; playerId?: string };
  if (!body.saveId || !body.playerId) {
    return NextResponse.json(
      { ok: false, error: 'saveId and playerId are required' },
      { status: 400 },
    );
  }

  const result = signFreeAgent(body.saveId, body.playerId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result.data });
};
