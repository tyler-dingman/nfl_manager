import { NextResponse } from 'next/server';

import { addTradeAsset } from '@/server/api/trades';

export const POST = async (
  request: Request,
  { params }: { params: { id: string } },
) => {
  const body = (await request.json()) as {
    side?: 'send' | 'receive';
    type?: 'player' | 'pick';
    playerId?: string;
    pickId?: string;
    saveId?: string;
  };

  if (!body.saveId) {
    return NextResponse.json(
      { ok: false, error: 'Missing or invalid saveId' },
      { status: 400 },
    );
  }

  if (!body.side || !body.type) {
    return NextResponse.json(
      { ok: false, error: 'side and type are required' },
      { status: 400 },
    );
  }

  const result = addTradeAsset(params.id, body, body.saveId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data);
};
