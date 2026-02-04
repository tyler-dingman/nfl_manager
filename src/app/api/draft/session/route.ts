import { NextResponse } from 'next/server';

import { getDraftSession } from '@/server/api/draft';

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const draftSessionId = searchParams.get('draftSessionId');
  if (!draftSessionId) {
    return NextResponse.json({ error: 'draftSessionId is required' }, { status: 400 });
  }

  return NextResponse.json(getDraftSession(draftSessionId));
};
