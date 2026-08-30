import { NextResponse } from 'next/server';

import { TEAM_LIST } from '@/data/teams';
import { teamContentEngine } from '@/features/content/content-engine';
import { getGeneratedTeamBriefings } from '@/features/content/generated-briefings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamAbbr = (url.searchParams.get('team') ?? 'NFL').toUpperCase();
  const team = TEAM_LIST.find((candidate) => candidate.abbr === teamAbbr);
  const teamName = team?.name ?? 'NFL';

  try {
    const generatedBriefings = getGeneratedTeamBriefings(teamAbbr);
    const briefings = generatedBriefings.length
      ? generatedBriefings
      : await teamContentEngine.buildBriefings(teamAbbr, teamName);
    return NextResponse.json({ teamAbbr, teamName, briefings });
  } catch (error) {
    console.error('[content-engine] failed to build briefings', error);
    return NextResponse.json({ error: 'Unable to build team briefings.' }, { status: 500 });
  }
}
