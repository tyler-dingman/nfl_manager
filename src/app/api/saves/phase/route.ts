import { NextResponse } from 'next/server';

import { setSavePhase } from '@/server/api/store';

export const POST = async (request: Request) => {
  let body: { saveId?: string; phase?: string } = {};
  try {
    body = (await request.json()) as { saveId?: string; phase?: string };
  } catch {
    body = {};
  }

  if (!body.saveId || !body.phase) {
    return NextResponse.json(
      { ok: false, error: 'saveId and phase are required' },
      { status: 400 },
    );
  }

  const result = setSavePhase(body.saveId, body.phase);
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
