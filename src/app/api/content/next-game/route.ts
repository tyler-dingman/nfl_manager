import { nextGameMarkets } from '@/server/odds/next-game-markets';
import { NextResponse } from 'next/server';
import { TEAM_LIST } from '@/data/teams';
import { nextCanonicalGame } from '@/server/schedule/repository';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const team = new URL(request.url).searchParams.get('team')?.toUpperCase();
  if (!TEAM_LIST.some((t) => t.abbr === team))
    return NextResponse.json({ error: 'Unknown NFL team.' }, { status: 404 });
  try {
    const game = await nextCanonicalGame(team!);
    const betting = game
      ? await nextGameMarkets(game).catch((error) => {
          console.error('[next-game] Saved markets unavailable', error);
          return null;
        })
      : null;
    return NextResponse.json({ game, betting });
  } catch (error) {
    console.error('[next-game] Unable to load schedule', error);
    return NextResponse.json({ error: 'Unable to load schedule.' }, { status: 503 });
  }
}
