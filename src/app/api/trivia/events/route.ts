import { NextRequest, NextResponse } from 'next/server';
import { TEAM_LIST } from '@/data/teams';
import { currentUser } from '@/server/auth/request';
import { nextTriviaEvent } from '@/server/trivia/event-repository';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const team = request.nextUrl.searchParams.get('team')?.toUpperCase();
  if (!TEAM_LIST.some((t) => t.abbr === team))
    return NextResponse.json({ error: 'Unknown team.' }, { status: 400 });
  try {
    const user = await currentUser(request);
    return NextResponse.json({ event: await nextTriviaEvent(team!, user?.id) });
  } catch (error) {
    console.error('[trivia-events] Unable to load event', error);
    return NextResponse.json({ error: 'Unable to load event.' }, { status: 503 });
  }
}
