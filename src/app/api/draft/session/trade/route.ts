import { NextResponse } from 'next/server';

import { applyDraftTrade } from '@/server/api/draft';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    draftSessionId?: string;
    partnerTeamAbbr?: string;
    sendPickIds?: string[];
    receivePickIds?: string[];
    saveId?: string;
  };

  if (!body.draftSessionId || !body.partnerTeamAbbr || !body.saveId) {
    return NextResponse.json(
      { ok: false, error: 'draftSessionId, partnerTeamAbbr, and saveId are required' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      ok: true,
      data: applyDraftTrade(
        body.draftSessionId,
        body.partnerTeamAbbr,
        body.sendPickIds ?? [],
        body.receivePickIds ?? [],
        body.saveId,
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to apply trade';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
