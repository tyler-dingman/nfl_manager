import { NextResponse } from 'next/server';

import { createDraftSession, getDraftSession } from '@/server/api/draft';
import { getSaveStateResult, listSaveStates } from '@/server/api/store';
import type { DraftMode } from '@/types/draft';

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const draftSessionId = searchParams.get('draftSessionId');
  const saveId = searchParams.get('saveId');
  if (!draftSessionId) {
    return NextResponse.json({ ok: false, error: 'draftSessionId is required' }, { status: 400 });
  }

  try {
    const resolvedSaveId =
      saveId ??
      listSaveStates().find((entry) => Boolean(entry.state.draftSessions[draftSessionId]))?.saveId;

    if (!resolvedSaveId) {
      return NextResponse.json({ ok: false, error: 'Draft session not found' }, { status: 404 });
    }

    const session = getDraftSession(draftSessionId, resolvedSaveId);
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Draft session not found';
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
};

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

  const existingSession = Object.values(stateResult.data.draftSessions)
    .slice()
    .sort((a, b) =>
      a.currentPickIndex === b.currentPickIndex
        ? 0
        : a.currentPickIndex < b.currentPickIndex
          ? 1
          : -1,
    )
    .find((session) => session.status === 'in_progress');

  if (existingSession) {
    const session = getDraftSession(existingSession.id, body.saveId);
    return NextResponse.json({ ok: true, draftSessionId: session.id, session });
  }

  const sessionStart = createDraftSession(mode, body.saveId);
  const session = getDraftSession(sessionStart.draftSessionId, body.saveId);

  return NextResponse.json({ ok: true, draftSessionId: session.id, session });
};
