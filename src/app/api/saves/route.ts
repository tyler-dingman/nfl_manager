import { NextResponse } from 'next/server';

import { ensureSave } from '@/server/api/save';

export const POST = async (request: Request) => {
  const body = (await request.json()) as { teamAbbr?: string; teamId?: string };
  const resolvedTeam = body.teamAbbr?.toUpperCase() ?? body.teamId?.toUpperCase();

  if (!resolvedTeam) {
    return NextResponse.json(
      { ok: false, error: 'teamId or teamAbbr is required' },
      { status: 400 },
    );
  }

  const { saveId, header } = ensureSave(body.teamId, body.teamAbbr);

  return NextResponse.json({
    ok: true,
    saveId,
    teamAbbr: header.teamAbbr,
    capSpace: header.capSpace,
    capLimit: header.capLimit,
    rosterCount: header.rosterCount,
    rosterLimit: header.rosterLimit,
    phase: header.phase,
    createdAt: header.createdAt,
  });
};
