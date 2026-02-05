import { NextResponse } from 'next/server';

import { setDraftSessionPaused } from '@/server/api/draft';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    draftSessionId?: string;
    saveId?: string;
    isPaused?: boolean;
  };

  if (!body.draftSessionId || !body.saveId || typeof body.isPaused !== 'boolean') {
    return NextResponse.json(
      { ok: false, error: 'draftSessionId, saveId, and isPaused are required' },
      { status: 400 },
    );
  }

  try {
    const session = setDraftSessionPaused(body.draftSessionId, body.saveId, body.isPaused);
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update pause state';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
