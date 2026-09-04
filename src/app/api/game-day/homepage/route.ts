import { NextRequest, NextResponse } from 'next/server';

import { getHomepageGame } from '@/server/game-day/homepage-game';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const team = (request.nextUrl.searchParams.get('team') ?? '').toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(team))
    return NextResponse.json({ error: 'A valid team abbreviation is required.' }, { status: 400 });
  const development = process.env.NODE_ENV !== 'production';
  const forceGameDay = development && request.nextUrl.searchParams.get('gameday') === '1';
  const requestedAt = development ? request.nextUrl.searchParams.get('gamedayAt') : null;
  const now = requestedAt ? new Date(requestedAt) : new Date();
  if (Number.isNaN(now.getTime()))
    return NextResponse.json({ error: 'Invalid Game Day preview time.' }, { status: 400 });
  try {
    return NextResponse.json({ game: await getHomepageGame(team, { now, forceGameDay }) });
  } catch (error) {
    console.error('[game-day-hero] schedule lookup failed', error);
    return NextResponse.json({ game: null });
  }
}
