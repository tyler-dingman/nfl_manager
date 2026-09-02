import { NextRequest, NextResponse } from 'next/server';

import { TEAM_LIST } from '@/data/teams';
import { snapshotStoryStates } from '@/features/catch-up/engine';
import { getThreeAndOutPackage } from '@/features/three-and-out/data';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { completeCatchUp } from '@/server/user/content-repository';
import { awardYards } from '@/server/rewards/repository';
import { contentSnapshotId, loadTeamBriefings } from '@/server/content/team-briefings';
import { canonicalThreeAndOut } from '@/server/content/canonical-surfaces';

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const body = (await request.json()) as { teamId?: string };
  const teamId = body.teamId?.toUpperCase() ?? '';
  if (!TEAM_LIST.some((team) => team.abbr === teamId))
    return NextResponse.json({ error: 'A valid team is required.' }, { status: 400 });

  const snapshot =
    (await canonicalThreeAndOut(teamId))?.current ?? getThreeAndOutPackage(teamId).current;
  const briefings = await loadTeamBriefings(teamId);
  const currentSnapshotId = contentSnapshotId(teamId, briefings);
  const state = await completeCatchUp({
    userId: user.id,
    teamId,
    snapshotId: currentSnapshotId,
    storyState: snapshotStoryStates(snapshot),
  });
  if (!state)
    return NextResponse.json({ error: 'Catch-up baseline was not found.' }, { status: 404 });
  const yardAward = await awardYards({
    userId: user.id,
    action: 'CATCH_UP_COMPLETE',
    sourceType: 'CATCH_UP_SNAPSHOT',
    sourceId: currentSnapshotId,
  });
  return NextResponse.json({
    ok: true,
    caughtUpAt: new Date(state.lastCaughtUpAt ?? new Date()).toISOString(),
    snapshotId: state.lastCaughtUpSnapshotId,
    yardAward,
  });
}
