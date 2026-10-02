import { notFound } from 'next/navigation';
import Preview from './preview';
import { createFranchiseSimulation, advanceSimulation } from '@/lib/franchise-simulation';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import { createFallbackRegularSeasonSchedule } from '@/server/front-office/calendar';
import { generateFrontOfficeEvents } from '@/server/front-office/event-engine';
import { isFrontOfficeNewsNotification } from '@/lib/front-office-news-notifications';
export default function Page({ searchParams }: { searchParams: { mode?: string } }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const teams = NFL_LEAGUE_DATA.teams.map((t) => ({
    abbr: t.abbr,
    conference: t.conference,
    division: t.division,
    overall: t.teamOverview ?? 80,
  }));
  const previous = createFranchiseSimulation({
    seed: 'preview',
    season: 2026,
    teams,
    games: createFallbackRegularSeasonSchedule(
      teams.map((t) => t.abbr),
      2026,
    ).map((g) => ({ ...g, homeTeam: g.homeTeam!, awayTeam: g.awayTeam! })),
  });
  const current = advanceSimulation(previous, 'week-2', {
    players: NFL_LEAGUE_DATA.players.map((p) => ({
      id: p.id,
      name: p.name,
      teamAbbr: p.teamAbbr,
      position: p.position,
      rating: p.rating,
    })),
  });
  const events = generateFrontOfficeEvents({
    saveId: 'visual-preview',
    teamAbbr: 'KC',
    previous,
    current,
  })
    .filter(isFrontOfficeNewsNotification)
    .map((e) => ({
      ...e,
      createdAt: new Date().toISOString(),
      readAt: null,
      dismissedAt: null,
      surfacedAt: null,
    }));
  return <Preview events={events} initialMode={searchParams.mode} />;
}
