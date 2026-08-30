import { NextResponse } from 'next/server';

import { buildTeamEvents } from '@/features/source-engine/team-event-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const teamId = (new URL(request.url).searchParams.get('team') ?? 'KC').toUpperCase();
  return NextResponse.json(buildTeamEvents(teamId));
}
