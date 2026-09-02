import { NextResponse } from 'next/server';
import { TEAM_LIST } from '@/data/teams';
import { getTeamHomepageData } from '@/server/content/canonical-surfaces';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const teamId = (new URL(request.url).searchParams.get('team') ?? '').toUpperCase();
  if (!TEAM_LIST.some((t) => t.abbr === teamId))
    return NextResponse.json({ error: 'Unknown NFL team.' }, { status: 404 });
  return NextResponse.json(await getTeamHomepageData(teamId));
}
