import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { findLocalOddsEvent, getLocalEventMarkets } from '@/server/odds/repository';

export async function GET() {
  const event = await findLocalOddsEvent('KC', 'DEN', 2026);
  if (!event)
    return NextResponse.json({ error: 'DEN @ KC has not been imported.' }, { status: 404 });
  const mahomes = NFL_LEAGUE_DATA.players.find((player) => player.name === 'Patrick Mahomes');
  const walker = NFL_LEAGUE_DATA.players.find((player) => player.name === 'Kenneth Walker III');
  const all = (await getLocalEventMarkets(event.id)) as Array<Record<string, unknown>>;
  const legs = [
    {
      id: 'kc-ml',
      label: 'Kansas City ML',
      match: (row: Record<string, unknown>) =>
        row.marketType === 'MONEYLINE' && row.teamId === 'KC',
    },
    {
      id: 'mahomes-250',
      label: 'Patrick Mahomes 250+ Passing Yards',
      match: (row: Record<string, unknown>) =>
        row.marketType === 'PASSING_YARDS' &&
        row.playerId === mahomes?.id &&
        Math.abs(Number(row.line) - 249.5) <= 0.25 &&
        row.side === 'OVER',
    },
    {
      id: 'walker-50',
      label: 'Kenneth Walker III 50+ Rushing Yards',
      match: (row: Record<string, unknown>) =>
        row.marketType === 'RUSHING_YARDS' &&
        row.playerId === walker?.id &&
        Math.abs(Number(row.line) - 49.5) <= 0.25 &&
        row.side === 'OVER',
    },
  ].map((leg) => ({ id: leg.id, label: leg.label, prices: all.filter(leg.match) }));
  return NextResponse.json({ event, legs, note: 'Final parlay price shown at sportsbook.' });
}
