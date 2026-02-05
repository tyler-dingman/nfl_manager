import { NextResponse } from 'next/server';

import { getDraftSession } from '@/server/api/draft';
import { listSaveStates } from '@/server/api/store';

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get('saveId');

  if (!saveId) {
    return NextResponse.json({ ok: false, error: 'saveId is required' }, { status: 400 });
  }

  const saveEntry = listSaveStates().find((entry) => entry.saveId === saveId);
  if (!saveEntry) {
    return NextResponse.json({ ok: true, session: null });
  }

  const sessions = Object.values(saveEntry.state.draftSessions);
  const activeSession = sessions
    .slice()
    .sort((a, b) =>
      a.currentPickIndex === b.currentPickIndex
        ? 0
        : a.currentPickIndex < b.currentPickIndex
          ? 1
          : -1,
    )
    .find((session) => session.status === 'in_progress');

  if (!activeSession) {
    return NextResponse.json({ ok: true, session: null });
  }

  const session = getDraftSession(activeSession.id, saveId);
  return NextResponse.json({ ok: true, session });
};
