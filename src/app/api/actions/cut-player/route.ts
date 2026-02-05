import { NextResponse } from 'next/server';

import { cutPlayer } from '@/server/api/players';
import { ensureSave } from '@/server/api/save';
import { getSaveHeaderSnapshot, getSaveStateResult } from '@/server/api/store';

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as {
      saveId?: string;
      playerId?: string;
      teamId?: string;
      teamAbbr?: string;
    };

    if (!body.saveId) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
    }

    if (!body.playerId) {
      return NextResponse.json({ ok: false, error: 'playerId is required' }, { status: 400 });
    }

    let result = cutPlayer(body.saveId, body.playerId);
    if (!result.ok && result.error === 'Save not found' && (body.teamId || body.teamAbbr)) {
      const fallback = ensureSave(body.teamId, body.teamAbbr);
      result = cutPlayer(fallback.saveId, body.playerId);
    }
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }

    // Get updated header
    const stateResult = getSaveStateResult(result.data.header.id);
    if (!stateResult.ok) {
      return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      header: getSaveHeaderSnapshot(stateResult.data),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: 'Unable to cut player right now.' },
      { status: 500 },
    );
  }
};
