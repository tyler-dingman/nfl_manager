import { NextResponse } from 'next/server';

import { removeTradeAsset } from '@/server/api/trades';

export const POST = async (request: Request, { params }: { params: { id: string } }) => {
  const body = (await request.json()) as {
    side?: 'send' | 'receive';
    assetId?: string;
    playerId?: string;
    pickId?: string;
    saveId?: string;
  };

  if (!body.saveId) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
  }

  if (!body.side) {
    return NextResponse.json({ ok: false, error: 'side is required' }, { status: 400 });
  }

  const result = removeTradeAsset(
    params.id,
    {
      side: body.side,
      assetId: body.assetId,
      playerId: body.playerId,
      pickId: body.pickId,
    },
    body.saveId,
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data);
};
