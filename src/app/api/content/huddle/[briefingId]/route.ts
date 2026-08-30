import { NextResponse } from 'next/server';

import { TEAM_LIST } from '@/data/teams';
import { teamContentEngine } from '@/features/content/content-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { briefingId: string } }) {
  const url = new URL(request.url);
  const teamAbbr = (url.searchParams.get('team') ?? 'NFL').toUpperCase();
  const team = TEAM_LIST.find((candidate) => candidate.abbr === teamAbbr);
  const briefings = await teamContentEngine.buildBriefings(teamAbbr, team?.name ?? 'NFL');
  const briefing = briefings.find((candidate) => candidate.id === params.briefingId);

  return briefing
    ? NextResponse.json(briefing)
    : NextResponse.json({ error: 'Briefing not found.' }, { status: 404 });
}
