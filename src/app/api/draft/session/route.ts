import { NextResponse } from 'next/server';

import { getDraftSession } from '@/server/api/draft';
import { listSaveStates } from '@/server/api/store';

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
