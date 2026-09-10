import { NextRequest, NextResponse } from 'next/server';

import { createSave, getSavesByTeam } from '@/server/api/save';
import { ensureSaveState, getSaveHeaderSnapshot, setSavePhase } from '@/server/api/store';
import { currentUser } from '@/server/auth/request';
import {
  getLatestFrontOfficeSaveForTeam,
  upsertFrontOfficeSaveMetadata,
} from '@/server/front-office/repository';

export const POST = async (request: NextRequest) => {
  const body = (await request.json()) as { teamId?: string; teamAbbr?: string; year?: number };
  const resolvedTeam = body.teamAbbr?.toUpperCase() ?? body.teamId?.toUpperCase();

  if (!resolvedTeam) {
    return NextResponse.json(
      { ok: false, error: 'teamId or teamAbbr is required' },
      { status: 400 },
    );
  }

  const user = await currentUser(request);
  const durable = user ? await getLatestFrontOfficeSaveForTeam(user.id, resolvedTeam) : null;
  let header;
  if (durable) {
    const state = ensureSaveState(durable.saveId, durable.teamAbbr);
    if (durable.simulationPhase) setSavePhase(durable.saveId, durable.simulationPhase);
    header = getSaveHeaderSnapshot(state);
  } else {
    const existingSaves = getSavesByTeam(body.teamId, body.teamAbbr);
    header = existingSaves[0] ?? createSave(resolvedTeam, body.year);
    if (user) {
      await upsertFrontOfficeSaveMetadata({
        userId: user.id,
        saveId: header.id,
        teamAbbr: header.teamAbbr,
        season: header.year,
        simulationPhase: header.phase,
      });
    }
  }
  const saveId = header.id;

  return NextResponse.json({
    ok: true,
    saveId,
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
