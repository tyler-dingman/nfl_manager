import { NextResponse } from 'next/server';

import { cutPlayer } from '@/server/api/players';

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as {
      saveId?: string;
      playerId?: string;
    };

    if (!body.saveId) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
    }

    if (!body.playerId) {
      return NextResponse.json({ ok: false, error: 'playerId is required' }, { status: 400 });
    }

    const result = cutPlayer(body.saveId, body.playerId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: 'Unable to cut player right now.' },
      { status: 500 },
    );
  }
};
