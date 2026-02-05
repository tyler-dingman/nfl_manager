import { NextResponse } from 'next/server';

import { proposeTrade } from '@/server/api/trades';

export const POST = async (request: Request, { params }: { params: { id: string } }) => {
  const body = (await request.json()) as { saveId?: string };
  if (!body.saveId) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
  }

  const result = proposeTrade(params.id, body.saveId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data);
};
