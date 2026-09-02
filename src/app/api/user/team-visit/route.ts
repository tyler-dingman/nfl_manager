import { NextRequest, NextResponse } from 'next/server';

import { getThreeAndOutPackage } from '@/features/three-and-out/data';
import { buildCatchMeUp } from '@/server/user/content-state';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getTeamVisitState, listContentState, updateTeamVisitState } from '@/server/user/content-repository';

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const teamId = (request.nextUrl.searchParams.get('team') ?? '').toUpperCase();
  if (!teamId) return NextResponse.json({ error: 'team is required.' }, { status: 400 });
  const data = getThreeAndOutPackage(teamId);
  const [previousVisit, audioState] = await Promise.all([
    getTeamVisitState(user.id, teamId),
    listContentState(user.id, [data.current.id]),
  ]);
  const catchMeUp = buildCatchMeUp({
    previousVisit: previousVisit as { lastVisitedAt?: string; lastSeenSnapshotId?: string | null } | null,
    currentSnapshotId: data.current.id,
    stories: data.current.stories,
    currentAudioVersion: data.current.audioScriptVersion,
    previousAudioVersion: (audioState[0]?.mediaVersion as string | null | undefined) ?? null,
  });
  return NextResponse.json({ ok: true, teamId, previousVisit, currentSnapshotId: data.current.id, catchMeUp });
}

export async function PUT(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const body = (await request.json()) as { teamId?: string; snapshotId?: string };
  if (!body.teamId || !body.snapshotId) return NextResponse.json({ error: 'teamId and snapshotId are required.' }, { status: 400 });
  return NextResponse.json({ ok: true, visit: await updateTeamVisitState(user.id, body.teamId.toUpperCase(), body.snapshotId) });
}