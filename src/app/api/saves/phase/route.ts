import { NextRequest, NextResponse } from 'next/server';
import { POST as advanceSimulation } from '@/app/api/front-office/simulate/route';
import { currentUser } from '@/server/auth/request';
import { getFrontOfficeSaveMetadata } from '@/server/front-office/repository';
import { ensureSaveState, getSaveHeaderSnapshot, syncSaveSimulation } from '@/server/api/store';

/** Compatibility for the draft room: all actual transitions use the simulation command. */
export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.saveId || !body.phase)
    return NextResponse.json(
      { ok: false, error: 'saveId and phase are required' },
      { status: 400 },
    );
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  const metadata = await getFrontOfficeSaveMetadata(user.id, body.saveId);
  if (!metadata) return NextResponse.json({ ok: false, error: 'Save not found.' }, { status: 404 });
  let simulation = metadata.simulation;
  if (!simulation || simulation.phase !== body.phase) {
    const response = await advanceSimulation(
      new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ saveId: body.saveId, action: 'advance', target: body.phase }),
      }),
    );
    if (!response.ok) return response;
    simulation = (await response.json()).state;
  }
  const state = ensureSaveState(body.saveId, metadata.teamAbbr, metadata.season);
  syncSaveSimulation(body.saveId, simulation!);
  const header = getSaveHeaderSnapshot(state);
  return NextResponse.json({ ok: true, ...header, saveId: header.id });
}
