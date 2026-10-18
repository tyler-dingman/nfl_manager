import { withFranchiseRoute } from '@/server/front-office/durable-route';
import { refreshFranchiseHeroAfterAction } from '@/server/front-office/refresh-hero';
import { tradeDeadlineResponse } from '@/server/front-office/trade-window';
import { NextRequest, NextResponse } from 'next/server';

import { proposeTrade } from '@/server/api/trades';

const handlePOST = async (request: NextRequest, { params: asyncparams }: { params: Promise<{ id: string }> }) => {
const params = await asyncparams;

  try {
    const body = (await request.json()) as { saveId?: string };
    if (!body.saveId) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
    }
    const deadline = await tradeDeadlineResponse(request, body.saveId);
    if (deadline) return deadline;

    const result = proposeTrade(params.id, body.saveId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }

    const events = await refreshFranchiseHeroAfterAction(request, body.saveId);
    return NextResponse.json({ ...result.data, events });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to propose trade';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};

export const POST = withFranchiseRoute(handlePOST, {});
