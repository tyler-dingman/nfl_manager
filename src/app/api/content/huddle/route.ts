import { NextResponse } from 'next/server';

import { TEAM_LIST } from '@/data/teams';
import { loadTeamBriefings } from '@/server/content/team-briefings';
import { canonicalHuddle } from '@/server/content/canonical-surfaces';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamAbbr = (url.searchParams.get('team') ?? 'NFL').toUpperCase();
  const team = TEAM_LIST.find((candidate) => candidate.abbr === teamAbbr);
  const teamName = team?.name ?? 'NFL';

  try {
    // The Beat is the complete chronological team feed. Three & Out may feature
    // the same story, but featuring it must not remove it from The Beat.
    const canonical = await canonicalHuddle(teamAbbr, [], 100, 'LATEST');
    const briefings = canonical.length ? canonical : await loadTeamBriefings(teamAbbr);
    return NextResponse.json({ teamAbbr, teamName, briefings });
  } catch (error) {
    console.error('[content-engine] failed to build briefings', error);
    return NextResponse.json({ error: 'Unable to build team briefings.' }, { status: 500 });
  }
}
