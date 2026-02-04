import { NextResponse } from 'next/server';

import { applyDraftTrade } from '@/server/api/draft';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    draftSessionId?: string;
    partnerTeamAbbr?: string;
    sendPickIds?: string[];
    receivePickIds?: string[];
  };

  if (!body.draftSessionId || !body.partnerTeamAbbr) {
    return NextResponse.json(
      { error: 'draftSessionId and partnerTeamAbbr are required' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    applyDraftTrade(
      body.draftSessionId,
      body.partnerTeamAbbr,
      body.sendPickIds ?? [],
      body.receivePickIds ?? [],
    ),
  );
};
