import { NextResponse } from 'next/server';

import { createSave, getSavesByTeam } from '@/server/api/save';

export const POST = async (request: Request) => {
  const body = (await request.json()) as { teamId?: string; teamAbbr?: string };
  const resolvedTeam = body.teamAbbr?.toUpperCase() ?? body.teamId?.toUpperCase();

  if (!resolvedTeam) {
    return NextResponse.json(
      { ok: false, error: 'teamId or teamAbbr is required' },
      { status: 400 },
    );
  }

  const existingSaves = getSavesByTeam(body.teamId, body.teamAbbr);
  const header = existingSaves[0] ?? createSave(resolvedTeam);
  const saveId = header.id;

  return NextResponse.json({
    ok: true,
    saveId,
    teamAbbr: header.teamAbbr,
    capSpace: header.capSpace,
    capLimit: header.capLimit,
    rosterCount: header.rosterCount,
    rosterLimit: header.rosterLimit,
    phase: header.phase,
    unlocked: header.unlocked,
    createdAt: header.createdAt,
  });
};
