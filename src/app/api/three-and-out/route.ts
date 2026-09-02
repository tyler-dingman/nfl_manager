import { NextResponse } from 'next/server';

import { TEAM_LIST } from '@/data/teams';
import { getThreeAndOutPackage } from '@/features/three-and-out/data';
import { getEditorialOverrides } from '@/features/three-and-out/editorial-store';
import { getPollVotes } from '@/features/three-and-out/poll-store';
import { canonicalThreeAndOut } from '@/server/content/canonical-surfaces';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamId = (url.searchParams.get('team') ?? 'KC').toUpperCase();
  if (!TEAM_LIST.some((team) => team.abbr === teamId)) {
    return NextResponse.json({ error: 'Unknown NFL team.' }, { status: 404 });
  }
  const data =
    (await canonicalThreeAndOut(teamId)) ??
    getThreeAndOutPackage(teamId, getEditorialOverrides(teamId));
  const recorded = getPollVotes(data.current.fourthDown.id);
  for (const optionId of recorded.values()) {
    const option = data.current.fourthDown.options.find((candidate) => candidate.id === optionId);
    if (option) option.votes += 1;
  }
  return NextResponse.json(data);
}
