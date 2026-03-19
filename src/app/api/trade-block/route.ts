import { NextResponse } from 'next/server';

import { getTradeBlock } from '@/server/api/trade-block';

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get('saveId');
  const teamAbbr = searchParams.get('teamAbbr');

  if (!saveId) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
  }

  const result = getTradeBlock(saveId, teamAbbr);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data);
};
