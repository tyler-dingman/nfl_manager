import { NextResponse } from 'next/server';

import { getSaveHeaderSnapshot, restoreSaveState } from '@/server/api/store';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveUnlocksDTO } from '@/types/save';

export const POST = async (request: Request) => {
  let body:
    | {
        saveId?: string;
        teamAbbr?: string;
        year?: number;
        capSpace?: number;
        capLimit?: number;
        roster?: PlayerRowDTO[];
        phase?: string;
        unlocked?: SaveUnlocksDTO;
        createdAt?: string;
      }
    | undefined;

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = undefined;
  }

  if (
    !body?.saveId ||
    !body.teamAbbr ||
    typeof body.capSpace !== 'number' ||
    typeof body.capLimit !== 'number' ||
    !Array.isArray(body.roster)
  ) {
    return NextResponse.json(
      { ok: false, error: 'saveId, teamAbbr, capSpace, capLimit, and roster are required' },
      { status: 400 },
    );
  }

  const state = restoreSaveState(body.saveId, {
    teamAbbr: body.teamAbbr,
    year: body.year,
    capSpace: body.capSpace,
    capLimit: body.capLimit,
    roster: body.roster,
    phase: body.phase,
    unlocked: body.unlocked,
    createdAt: body.createdAt,
  });
  const header = getSaveHeaderSnapshot(state);

  return NextResponse.json({
    ok: true,
    saveId: header.id,
    teamAbbr: header.teamAbbr,
    year: header.year,
    capSpace: header.capSpace,
    capLimit: header.capLimit,
    rosterCount: header.rosterCount,
    rosterLimit: header.rosterLimit,
    phase: header.phase,
    unlocked: header.unlocked,
    createdAt: header.createdAt,
  });
};
