import { NextRequest, NextResponse } from 'next/server';
import { POST as advanceSimulation } from '@/app/api/front-office/simulate/route';
import { getSaveStateResult, getSaveHeaderSnapshot } from '@/server/api/store';

/** The season recap enters the Combine through the same guarded simulation transition. */
export async function POST(request: NextRequest) {
  const { saveId } = await request.json();
  const response = await advanceSimulation(
    new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ saveId, action: 'advance', target: 'scouting_combine' }),
    }),
  );
  if (!response.ok) return response;
  const state = getSaveStateResult(saveId);
  if (!state.ok) return NextResponse.json({ ok: false, error: state.error }, { status: 404 });
  const header = getSaveHeaderSnapshot(state.data);
  return NextResponse.json({ ok: true, ...header, saveId: header.id, roster: state.data.roster });
}
