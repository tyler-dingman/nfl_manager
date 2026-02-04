import { NextResponse } from 'next/server';

import { offerContract } from '@/server/api/players';

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as {
      saveId?: string;
      playerId?: string;
      years?: number;
      apy?: number;
    };

    if (!body.saveId) {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid saveId' },
        { status: 400 },
      );
    }

    if (!body.playerId || typeof body.years !== 'number' || typeof body.apy !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'playerId, years, and apy are required' },
        { status: 400 },
      );
    }

    const result = offerContract(body.saveId, body.playerId, body.years, body.apy);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ...result.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: 'Unable to submit offer right now.' },
      { status: 500 },
    );
  }
};
