import { NextRequest, NextResponse } from 'next/server';
import { POST as advanceSimulation } from '@/app/api/front-office/simulate/route';
import { getFrontOfficePhaseActions, isOffseasonFreeAgency } from '@/lib/front-office-phase';
import { currentUser } from '@/server/auth/request';
import { getFrontOfficeSaveMetadata } from '@/server/front-office/repository';

/** Legacy clients cannot advance a market clock independently of the franchise. */
export async function POST(request: NextRequest) {
  const { saveId } = await request.json();
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const metadata = saveId ? await getFrontOfficeSaveMetadata(user.id, saveId) : null;
  const phase = metadata?.simulation?.phase;
  if (!phase || !isOffseasonFreeAgency(phase))
    return NextResponse.json(
      { error: 'Free Agency progression is only available during offseason Free Agency.' },
      { status: 409 },
    );
  return advanceSimulation(
    new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        saveId,
        action: 'advance',
        target: getFrontOfficePhaseActions(phase).primary.target,
      }),
    }),
  );
}
