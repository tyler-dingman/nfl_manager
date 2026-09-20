import { NextResponse } from 'next/server';
import { POST as tradeHub } from '@/app/api/draft/trade-hub/route';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return tradeHub(
      new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          action: 'propose',
          team: body.partnerTeamAbbr,
          send: body.sendPickIds,
          receive: body.receivePickIds,
        }),
      }),
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid trade request.' }, { status: 400 });
  }
}
