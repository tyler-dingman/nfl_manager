import { NextRequest, NextResponse } from 'next/server';
import { withFranchiseRoute } from '@/server/front-office/durable-route';
import { franchiseWorkspace } from '@/server/front-office/runtime-context';
import { initializeNewRuntime } from '@/server/front-office/initial-runtime';
import { getSaveHeaderSnapshot } from '@/server/api/store';
import { upsertFrontOfficeSaveMetadata } from '@/server/front-office/repository';

async function create(request: NextRequest) {
  const body = await request.json();
  const workspace = franchiseWorkspace.getStore()!;
  let runtime = workspace.saves.get(workspace.saveId);
  if (!runtime) {
    const team = String(body.teamAbbr ?? body.teamId).toUpperCase();
    runtime = initializeNewRuntime(workspace.saveId, team, body.year);
    await upsertFrontOfficeSaveMetadata({
      userId: workspace.userId,
      saveId: workspace.saveId,
      teamAbbr: team,
      season: runtime.header.year,
      simulationPhase: runtime.header.phase,
    });
  }
  const { id, ...header } = getSaveHeaderSnapshot(runtime);
  return NextResponse.json({ ok: true, saveId: id, ...header });
}
export const POST = withFranchiseRoute(create, { create: true });
