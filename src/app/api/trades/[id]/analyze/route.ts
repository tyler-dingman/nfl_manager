import { NextResponse } from 'next/server';

import { analyzeTrade } from '@/server/api/trades';

export const POST = async (request: Request, { params }: { params: { id: string } }) => {
  try {
    const body = (await request.json()) as { saveId?: string };
    if (!body.saveId) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
    }
    const result = analyzeTrade(params.id, body.saveId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to analyze trade' },
      { status: 400 },
    );
  }
};
