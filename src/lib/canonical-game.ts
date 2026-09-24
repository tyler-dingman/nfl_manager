/** Shared persisted NFL game contract. Team IDs match existing stats/provider mappings. */
export type CanonicalGame = {
  id: string;
  providerEventId?: string;
  season: number;
  seasonType: 'PRE' | 'REG' | 'POST';
  week: number;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string | null;
  kickoffConfirmed: boolean;
  status: 'SCHEDULED' | 'LIVE' | 'FINAL' | 'POSTPONED' | 'CANCELED';
  homeScore: number | null;
  awayScore: number | null;
  overtime: boolean;
  venue: string | null;
  broadcastNetwork: string | null;
};
export function gameWeekLabel(game: CanonicalGame) {
  if (game.seasonType === 'POST')
    return (
      (
        { 1: 'WILD CARD', 2: 'DIVISIONAL', 3: 'CONF CHAMP', 5: 'SUPER BOWL' } as Record<
          number,
          string
        >
      )[game.week] ?? 'POSTSEASON'
    );
  return `${game.seasonType === 'PRE' ? 'PRESEASON' : 'WEEK'} ${game.week}`;
}
export function gameKickoffDisplay(game: Pick<CanonicalGame, 'kickoffAt' | 'kickoffConfirmed'>) {
  if (!game.kickoffAt || !game.kickoffConfirmed) return undefined;
  const date = new Date(game.kickoffAt);
  if (!Number.isFinite(date.getTime())) return undefined;
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' })
    .format(date)
    .toUpperCase();
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${day} · ${time} ET`;
}
export type BeatGameMetadata = CanonicalGame & {
  gameId: string;
  selectedTeam: string;
  opponent: string;
  homeAway: 'HOME' | 'AWAY';
  dayOfWeek?: string;
  kickoffDisplay?: string;
  weekDisplay: string;
  gameStatus: CanonicalGame['status'];
};
export function beatGameMetadata(game: CanonicalGame, selectedTeam: string): BeatGameMetadata {
  const kickoffDisplay = gameKickoffDisplay(game);
  return {
    ...game,
    gameId: game.id,
    selectedTeam,
    opponent: game.homeTeam === selectedTeam ? game.awayTeam : game.homeTeam,
    homeAway: game.homeTeam === selectedTeam ? 'HOME' : 'AWAY',
    kickoffDisplay,
    dayOfWeek: kickoffDisplay?.split(' · ')[0],
    weekDisplay: gameWeekLabel(game),
    gameStatus: game.status,
  };
}
