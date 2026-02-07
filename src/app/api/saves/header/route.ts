import { NextResponse } from 'next/server';

import { getSaveHeader } from '@/server/api/save';
import { ensureSaveState, getSaveState } from '@/server/api/store';

const getParam = (request: Request, key: string) =>
  new URL(request.url).searchParams.get(key) ?? undefined;

export const GET = async (request: Request) => {
  const saveId = getParam(request, 'saveId');
  const teamAbbr = getParam(request, 'teamAbbr');
  if (!saveId) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
  }

  if (!getSaveState(saveId) && teamAbbr) {
    ensureSaveState(saveId, teamAbbr);
  }

  const result = getSaveHeader(saveId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  const header = result.data;
  return NextResponse.json({
    ok: true,
    saveId: header.id,
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
