import { NextResponse } from 'next/server';

import { createDraftSession, getDraftSession } from '@/server/api/draft';
import { getSaveStateResult } from '@/server/api/store';
import type { DraftMode } from '@/types/draft';

export const POST = async (request: Request) => {
  let body: { mode?: DraftMode; saveId?: string } = {};
  try {
    body = (await request.json()) as { mode?: DraftMode; saveId?: string };
  } catch {
    body = {};
  }

  const mode = body.mode ?? 'mock';
  if (mode !== 'mock' && mode !== 'real') {
    return NextResponse.json({ ok: false, error: 'Invalid mode' }, { status: 400 });
  }

  if (!body.saveId) {
    return NextResponse.json({ ok: false, error: 'saveId is required' }, { status: 400 });
  }

  const stateResult = getSaveStateResult(body.saveId);
  if (!stateResult.ok) {
    return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
  }

  const sessionStart = createDraftSession(mode, body.saveId);
  const session = getDraftSession(sessionStart.draftSessionId, body.saveId);

  return NextResponse.json({
    ok: true,
    session,
  });
};
