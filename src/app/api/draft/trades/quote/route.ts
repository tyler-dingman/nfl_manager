import { NextResponse } from 'next/server';
import { getDraftSession, findSaveIdForDraftSession } from '@/server/api/draft';
import {
  resolveMockPackage,
  evaluateMockPackage,
  proposeMockTrade,
  tradeYear,
} from '@/lib/mock-draft-trades';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const saveId = body.saveId ?? findSaveIdForDraftSession(body.draftSessionId);
    if (!saveId || !body.draftSessionId) throw new Error('Draft session not found.');
    const session = structuredClone(getDraftSession(body.draftSessionId, saveId));
    const pkg = resolveMockPackage(
      session,
      body.partnerTeamAbbr,
      [body.sendPickId],
      [body.receivePickId],
    );
    const value = evaluateMockPackage(pkg.send, pkg.receive, tradeYear(session));
    const decision = proposeMockTrade(
      session,
      body.partnerTeamAbbr,
      [body.sendPickId],
      [body.receivePickId],
    );
    return NextResponse.json({
      ok: true,
      sendValue: value.sent,
      receiveValue: value.received,
      verdict: decision.outcome,
      reason: decision.reason,
      acceptanceProbability: decision.outcome === 'accepted' ? 1 : 0,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to quote trade.' },
      { status: 400 },
    );
  }
}
