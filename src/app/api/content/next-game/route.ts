import { NextResponse } from 'next/server';
import { TEAM_LIST } from '@/data/teams';
import { loadNextUp } from '@/server/schedule/next-up';
import { scheduleFailure } from '@/server/schedule/diagnostics';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const team = new URL(request.url).searchParams.get('team')?.toUpperCase();
  if (!TEAM_LIST.some((t) => t.abbr === team))
    return NextResponse.json({ error: 'Unknown NFL team.' }, { status: 404 });
  try {
    return NextResponse.json(await loadNextUp(team!));
  } catch (error) {
    console.error('[next-game] Unable to load schedule', {
      team,
      source: 'historical_games',
      ...scheduleFailure(error),
    });
    return NextResponse.json({ error: 'Unable to load schedule.' }, { status: 503 });
  }
}
