import { NextResponse } from 'next/server';

import { advanceDraftSession } from '@/server/api/draft';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    draftSessionId?: string;
    saveId?: string;
  };

  if (!body.draftSessionId || !body.saveId) {
    return NextResponse.json(
      { ok: false, error: 'draftSessionId and saveId are required' },
      { status: 400 },
    );
  }

  try {
    const session = advanceDraftSession(body.draftSessionId, body.saveId);
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to advance draft';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
