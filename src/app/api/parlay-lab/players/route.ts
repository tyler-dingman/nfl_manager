import { NextResponse } from 'next/server';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
export async function GET() {
  return NextResponse.json({
    players: NFL_LEAGUE_DATA.players.map(({ id, name, position, teamAbbr, headshotUrl }) => ({
      id,
      name,
      position,
      teamAbbr,
      headshotUrl,
    })),
  });
}
