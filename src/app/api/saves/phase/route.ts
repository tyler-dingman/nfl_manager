import { NextResponse } from 'next/server';

import { normalizePhase } from '@/lib/phase';
import { setSavePhase } from '@/server/api/save';

export const POST = async (request: Request) => {
  const body = (await request.json()) as { saveId?: string; phase?: string };

  if (!body.saveId || !body.phase) {
    return NextResponse.json(
      { ok: false, error: 'saveId and phase are required' },
      { status: 400 },
    );
  }

  const result = setSavePhase(body.saveId, normalizePhase(body.phase));

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    saveId: result.data.id,
    teamAbbr: result.data.teamAbbr,
    capSpace: result.data.capSpace,
    capLimit: result.data.capLimit,
    rosterCount: result.data.rosterCount,
    rosterLimit: result.data.rosterLimit,
    phase: result.data.phase,
    createdAt: result.data.createdAt,
  });
};
