import { NextResponse } from 'next/server';

import { TEAM_LIST } from '@/data/teams';
import { loadTeamBriefings } from '@/server/content/team-briefings';
import { canonicalHuddle, canonicalThreeAndOut } from '@/server/content/canonical-surfaces';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamAbbr = (url.searchParams.get('team') ?? 'NFL').toUpperCase();
  const team = TEAM_LIST.find((candidate) => candidate.abbr === teamAbbr);
  const teamName = team?.name ?? 'NFL';

  try {
    const threeAndOut = await canonicalThreeAndOut(teamAbbr);
    const canonical = await canonicalHuddle(teamAbbr, threeAndOut?.current.storyIds ?? [], 4);
    const briefings = canonical.length >= 4 ? canonical : await loadTeamBriefings(teamAbbr);
    return NextResponse.json({ teamAbbr, teamName, briefings });
  } catch (error) {
    console.error('[content-engine] failed to build briefings', error);
    return NextResponse.json({ error: 'Unable to build team briefings.' }, { status: 500 });
  }
}
