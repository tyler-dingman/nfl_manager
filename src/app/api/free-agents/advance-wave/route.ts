import { NextResponse } from 'next/server';

import { advanceFreeAgencyWave } from '@/server/api/players';
import { getSaveStateResult, hydrateOffseasonFreeAgencyState } from '@/server/api/store';

export async function POST(request: Request) {
  const body = (await request.json()) as { saveId?: string };
  if (!body.saveId) {
    return NextResponse.json({ ok: false, error: 'saveId is required' }, { status: 400 });
  }

  const stateResult = getSaveStateResult(body.saveId);
  if (!stateResult.ok) {
    return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
  }

  await hydrateOffseasonFreeAgencyState(stateResult.data);

  const result = advanceFreeAgencyWave(body.saveId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result.data });
}
