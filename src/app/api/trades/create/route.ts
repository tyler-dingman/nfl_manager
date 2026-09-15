import { NextRequest, NextResponse } from 'next/server';

import { ensureSaveState, getSaveState } from '@/server/api/store';
import { createTrade } from '@/server/api/trades';
import { currentUser } from '@/server/auth/request';
import { getFrontOfficeSaveMetadata } from '@/server/front-office/repository';

export const POST = async (request: NextRequest) => {
  const body = (await request.json()) as {
    saveId?: string;
    teamAbbr?: string;
    partnerTeamAbbr?: string;
    playerId?: string;
  };

  if (!body.saveId) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
  }

  const user = await currentUser(request);
  if (user) {
    const metadata = await getFrontOfficeSaveMetadata(user.id, body.saveId);
    if (metadata?.simulation && metadata.simulation.currentWeek > 9) {
      return NextResponse.json(
        { ok: false, error: 'The trade deadline passed Tuesday after Week 9 at 4:00 p.m. ET.' },
        { status: 403 },
      );
    }
  }

  if (!body.partnerTeamAbbr) {
    return NextResponse.json({ ok: false, error: 'partnerTeamAbbr is required' }, { status: 400 });
  }

  if (!getSaveState(body.saveId) && body.teamAbbr) {
    ensureSaveState(body.saveId, body.teamAbbr);
  }

  const result = createTrade(body.saveId, body.partnerTeamAbbr, body.playerId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data);
};
