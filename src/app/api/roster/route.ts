import { NextResponse } from 'next/server';

import { getRoster } from '@/server/api/players';
import { ensureSaveState, getSaveState } from '@/server/api/store';

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

  const filters = {
    position: getParam(request, 'position'),
    status: getParam(request, 'status'),
    query: getParam(request, 'query'),
  };

  const result = getRoster(saveId, filters);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data);
};
