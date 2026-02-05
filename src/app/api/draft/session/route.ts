import { NextResponse } from 'next/server';

import { getDraftSession } from '@/server/api/draft';

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const draftSessionId = searchParams.get('draftSessionId');
  const saveId = searchParams.get('saveId');
  if (!draftSessionId) {
    return NextResponse.json({ ok: false, error: 'draftSessionId is required' }, { status: 400 });
  }
  if (!saveId) {
    return NextResponse.json({ ok: false, error: 'saveId is required' }, { status: 400 });
  }

  try {
    const session = getDraftSession(draftSessionId);
    const sessionSaveId =
      'saveId' in session ? (session as { saveId?: string }).saveId : undefined;
    if (sessionSaveId && sessionSaveId !== saveId) {
      return NextResponse.json({ ok: false, error: 'Draft session not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Draft session not found';
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
};
