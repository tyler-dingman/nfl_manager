import { NextRequest, NextResponse } from 'next/server';
import { ensureSaveState } from '@/server/api/store';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getDraftProspectsForYear } from '@/server/data/draft-prospects';
import { buildDraftCentralIntelligence } from '@/server/front-office/draft/draft-intelligence';
import { getFrontOfficeSaveMetadata } from '@/server/front-office/repository';

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const saveId = request.nextUrl.searchParams.get('saveId');
  if (!saveId) return NextResponse.json({ error: 'saveId is required.' }, { status: 400 });
  const metadata = await getFrontOfficeSaveMetadata(user.id, saveId);
  if (!metadata) return NextResponse.json({ error: 'Save not found.' }, { status: 404 });
  // The database-backed Front Office save is canonical. The roster/trade asset store is a
  // derived process-local cache and may be empty after a dev-server restart or deployment.
  const save = ensureSaveState(saveId, metadata.teamAbbr, metadata.season);
  const draftYear = (metadata.simulation?.season ?? metadata.season) + 1;
  return NextResponse.json({
    ok: true,
    ...buildDraftCentralIntelligence({
      state: save,
      simulation: metadata.simulation ?? null,
      prospects: getDraftProspectsForYear(draftYear),
      teamAbbr: metadata.teamAbbr.toUpperCase(),
    }),
  });
}
