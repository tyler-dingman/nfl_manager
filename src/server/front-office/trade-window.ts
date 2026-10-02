import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { getFrontOfficeSaveMetadata } from './repository';
import { getSaveState } from '@/server/api/store';
import { isTradeDeadlinePassed, TRADE_DEADLINE_MESSAGE } from '@/lib/front-office-trade-window';

/** Check the durable franchise clock before any trade mutation, including saved offers. */
export async function tradeDeadlineResponse(request: Request, saveId: string) {
  const user = await currentUser(
    request instanceof NextRequest
      ? request
      : new NextRequest(request.url, { headers: request.headers }),
  );
  const metadata = user ? await getFrontOfficeSaveMetadata(user.id, saveId) : null;
  const phase =
    metadata?.simulation?.phase ?? metadata?.simulationPhase ?? getSaveState(saveId)?.header.phase;
  return isTradeDeadlinePassed(phase, metadata?.simulation?.currentWeek)
    ? NextResponse.json({ ok: false, error: TRADE_DEADLINE_MESSAGE }, { status: 403 })
    : null;
}
