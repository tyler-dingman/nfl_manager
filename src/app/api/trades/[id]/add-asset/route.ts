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
  };

  if (!body.side || !body.type) {
    return NextResponse.json(
      { error: 'side and type are required' },
      { status: 400 },
    );
  }

  return NextResponse.json(addTradeAsset(params.id, body));
};
