import { NextResponse } from 'next/server';

import { getSavesByTeam } from '@/server/api/save';

const getParam = (request: Request, key: string) =>
  new URL(request.url).searchParams.get(key) ?? undefined;

export const GET = async (request: Request) => {
  const teamAbbr = getParam(request, 'teamAbbr');
  const teamId = getParam(request, 'teamId');
  const resolvedTeam = teamAbbr?.toUpperCase() ?? teamId?.toUpperCase();

  if (!resolvedTeam) {
    return NextResponse.json(
      { ok: false, error: 'teamId or teamAbbr is required' },
      { status: 400 },
    );
  }

  const saves = getSavesByTeam(teamId, teamAbbr).map((header) => ({
    saveId: header.id,
    teamAbbr: header.teamAbbr,
    capSpace: header.capSpace,
    capLimit: header.capLimit,
    rosterCount: header.rosterCount,
    rosterLimit: header.rosterLimit,
    phase: header.phase,
    createdAt: header.createdAt,
  }));

  return NextResponse.json({
    ok: true,
    saves,
  });
};
