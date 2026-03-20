import { NextResponse } from 'next/server';

import { restoreSaveState, setSavePhase } from '@/server/api/store';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveUnlocksDTO } from '@/types/save';

export const POST = async (request: Request) => {
  let body:
    | {
        saveId?: string;
        phase?: string;
        teamAbbr?: string;
        capSpace?: number;
        capLimit?: number;
        roster?: PlayerRowDTO[];
        unlocked?: SaveUnlocksDTO;
        createdAt?: string;
      }
    | undefined = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!body?.saveId || !body.phase) {
    return NextResponse.json(
      { ok: false, error: 'saveId and phase are required' },
      { status: 400 },
    );
  }

  let result = setSavePhase(body.saveId, body.phase);
  if (
    !result.ok &&
    body.teamAbbr &&
    typeof body.capSpace === 'number' &&
    typeof body.capLimit === 'number' &&
    Array.isArray(body.roster)
  ) {
    restoreSaveState(body.saveId, {
      teamAbbr: body.teamAbbr,
      capSpace: body.capSpace,
      capLimit: body.capLimit,
      roster: body.roster,
      phase: body.phase,
      unlocked: body.unlocked,
      createdAt: body.createdAt,
    });
    result = setSavePhase(body.saveId, body.phase);
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  const header = result.data;
  return NextResponse.json({
    ok: true,
    saveId: header.id,
    teamAbbr: header.teamAbbr,
    capSpace: header.capSpace,
    capLimit: header.capLimit,
    rosterCount: header.rosterCount,
    rosterLimit: header.rosterLimit,
    phase: header.phase,
    unlocked: header.unlocked,
    createdAt: header.createdAt,
  });
};
