import { NextResponse } from 'next/server';

import { getSaveState } from '@/server/api/store';
import { summarizeFreeAgencyPool } from '@/server/logic/free-agency-pool';

export const GET = async (request: Request) => {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not available in production' }, { status: 404 });
  }

  const url = new URL(request.url);
  const saveId = url.searchParams.get('saveId');
  if (!saveId) {
    return NextResponse.json({ ok: false, error: 'Missing saveId' }, { status: 400 });
  }

  const state = getSaveState(saveId);
  if (!state) {
    return NextResponse.json({ ok: false, error: 'Save not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, summary: summarizeFreeAgencyPool(state.freeAgents) });
};
