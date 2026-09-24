import { currentUser } from '@/server/auth/request';
import { getFrontOfficeSaveMetadata } from '@/server/front-office/repository';
import { syncSaveSimulation } from '@/server/api/store';
import { NextRequest, NextResponse } from 'next/server';

import { getSaveHeader } from '@/server/api/save';

const getParam = (request: NextRequest, key: string) =>
  new URL(request.url).searchParams.get(key) ?? undefined;

export const GET = async (request: NextRequest) => {
  const saveId = getParam(request, 'saveId');
  const teamAbbr = getParam(request, 'teamAbbr');
  if (!saveId) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
  }

  const user = await currentUser(request);
  if (user) await getFrontOfficeSaveMetadata(user.id, saveId);
  const result = getSaveHeader(saveId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  const header = result.data;
  return NextResponse.json({
    ok: true,
    saveId: header.id,
    teamAbbr: header.teamAbbr,
    year: header.year,
    capSpace: header.capSpace,
    capLimit: header.capLimit,
    rosterCount: header.rosterCount,
    rosterLimit: header.rosterLimit,
    phase: header.phase,
    unlocked: header.unlocked,
    createdAt: header.createdAt,
  });
};
