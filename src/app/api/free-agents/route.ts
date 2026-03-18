import { NextResponse } from 'next/server';

import { getFreeAgents } from '@/server/api/players';
import {
  ensureSaveState,
  getSaveState,
  getSaveStateResult,
  hydrateOffseasonFreeAgencyState,
} from '@/server/api/store';

const getParam = (request: Request, key: string) =>
  new URL(request.url).searchParams.get(key) ?? undefined;

export const GET = async (request: Request) => {
  const saveId = getParam(request, 'saveId');
  const teamAbbr = getParam(request, 'teamAbbr');
  if (!saveId) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid saveId' }, { status: 400 });
  }

  if (!getSaveState(saveId) && teamAbbr) {
    ensureSaveState(saveId, teamAbbr);
  }

  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return NextResponse.json({ ok: false, error: stateResult.error }, { status: 404 });
  }

  await hydrateOffseasonFreeAgencyState(stateResult.data);

  const filters = {
    position: getParam(request, 'position'),
    status: getParam(request, 'status'),
    query: getParam(request, 'query'),
  };

  const result = getFreeAgents(saveId, filters);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data);
};
