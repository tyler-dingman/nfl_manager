import { NextResponse } from 'next/server';

import { advanceSaveStateToNextOffseason } from '@/server/api/store';

export const POST = async (request: Request) => {
  let body: { saveId?: string } = {};
  try {
    body = (await request.json()) as { saveId?: string };
  } catch {
    body = {};
  }

  if (!body.saveId) {
    return NextResponse.json({ ok: false, error: 'saveId is required' }, { status: 400 });
  }

  const result = advanceSaveStateToNextOffseason(body.saveId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    saveId: result.data.header.id,
    teamAbbr: result.data.header.teamAbbr,
    year: result.data.header.year,
    capSpace: result.data.header.capSpace,
    capLimit: result.data.header.capLimit,
    rosterCount: result.data.header.rosterCount,
    rosterLimit: result.data.header.rosterLimit,
    phase: result.data.header.phase,
    unlocked: result.data.header.unlocked,
    createdAt: result.data.header.createdAt,
    roster: result.data.roster,
  });
};
