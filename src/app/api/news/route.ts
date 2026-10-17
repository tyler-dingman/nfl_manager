import { withFranchiseRoute } from '@/server/front-office/durable-route';
import { NextResponse } from 'next/server';

import { getSaveStateResult } from '@/server/api/store';

const handleGET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get('saveId');
  if (!saveId) {
    return NextResponse.json({ ok: false, error: 'saveId is required' }, { status: 400 });
  }

  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true, items: stateResult.data.newsFeed ?? [] });
};

export const GET = withFranchiseRoute(handleGET, { reference: true });
