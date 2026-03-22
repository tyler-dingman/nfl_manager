import { NextResponse } from 'next/server';

import {
  advanceDraftSession,
  findSaveIdForDraftSession,
  restoreDraftSession,
} from '@/server/api/draft';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveUnlocksDTO } from '@/types/save';

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    draftSessionId?: string;
    saveId?: string;
    mode?: 'default' | 'best_available';
    sessionSnapshot?: DraftSessionDTO;
    saveSnapshot?: {
      teamAbbr: string;
      capSpace: number;
      capLimit: number;
      roster: PlayerRowDTO[];
      phase?: string;
      unlocked?: SaveUnlocksDTO;
      createdAt?: string;
    };
  };

  if (!body.draftSessionId || !body.saveId) {
    return NextResponse.json(
      { ok: false, error: 'draftSessionId and saveId are required' },
      { status: 400 },
    );
  }

  try {
    const resolvedSaveId = findSaveIdForDraftSession(body.draftSessionId) ?? body.saveId;
    const session = advanceDraftSession(body.draftSessionId, resolvedSaveId, body.mode);
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to advance draft';
    const canRestore =
      body.sessionSnapshot &&
      (message === 'Draft session not found' || message === 'Save not found');

    if (canRestore) {
      try {
        const restoredSaveId = body.saveId!;
        const sessionSnapshot = body.sessionSnapshot;
        if (!sessionSnapshot) {
          return NextResponse.json({ ok: false, error: message }, { status: 400 });
        }
        restoreDraftSession(restoredSaveId, sessionSnapshot, body.saveSnapshot);
        const session = advanceDraftSession(body.draftSessionId, restoredSaveId, body.mode);
        return NextResponse.json({ ok: true, session });
      } catch (restoreError) {
        const restoreMessage =
          restoreError instanceof Error ? restoreError.message : 'Unable to advance draft';
        return NextResponse.json({ ok: false, error: restoreMessage }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
