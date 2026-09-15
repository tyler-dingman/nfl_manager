import { NextRequest, NextResponse } from 'next/server';

import { proposeTrade } from '@/server/api/trades';
import { currentUser } from '@/server/auth/request';
import { getFrontOfficeSaveMetadata } from '@/server/front-office/repository';

export const POST = async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const body = (await request.json()) as { saveId?: string };
    if (!body.saveId) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
    }
    const user = await currentUser(request);
    if (user) {
      const metadata = await getFrontOfficeSaveMetadata(user.id, body.saveId);
      if (metadata?.simulation && metadata.simulation.currentWeek > 9) {
        return NextResponse.json(
          { ok: false, error: 'The trade deadline passed Tuesday after Week 9 at 4:00 p.m. ET.' },
          { status: 403 },
        );
      }
    }

    const result = proposeTrade(params.id, body.saveId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to propose trade';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
