import { NextResponse } from 'next/server';

import { createDraftSession } from '@/server/api/draft';
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
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  if (mode === 'real' && !body.saveId) {
    return NextResponse.json({ error: 'saveId is required for real mode' }, { status: 400 });
  }

  return NextResponse.json(createDraftSession(mode, body.saveId));
};
