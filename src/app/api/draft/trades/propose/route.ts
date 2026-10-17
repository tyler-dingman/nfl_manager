import { withFranchiseRoute } from '@/server/front-office/durable-route';
import { NextResponse } from 'next/server';
import { POST as tradeHub } from '@/app/api/draft/trade-hub/route';

// Compatibility endpoint: all mock proposals use the same deterministic engine.
async function handlePOST(request: Request) {
  try {
    const body = await request.json();
    const response = await tradeHub(
      new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          action: 'propose',
          team: body.partnerTeamAbbr,
          send: [body.sendPickId],
          receive: [body.receivePickId],
        }),
      }),
    );
    const result = await response.json();
    return NextResponse.json(
      { ...result, accepted: result.outcome === 'accepted' },
      { status: response.status },
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid trade request.' }, { status: 400 });
  }
}

export const POST = withFranchiseRoute(handlePOST, {});
