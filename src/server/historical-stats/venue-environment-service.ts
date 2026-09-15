import { NFL_STADIUMS, type RoofType } from '@/data/nfl-stadiums';
import type { HistoricalPlayerGame } from './types';

export type VenueEnvironment = 'INDOOR' | 'OUTDOOR' | 'UNKNOWN';
export type VenueContext = {
  stadium: string | null;
  roofType: RoofType;
  environment: VenueEnvironment;
  statusKnown: boolean;
};
const environmentForRoof = (roofType: RoofType): VenueEnvironment =>
  roofType === 'FIXED_DOME' ? 'INDOOR' : roofType === 'OPEN_AIR' ? 'OUTDOOR' : 'UNKNOWN';
export function venueContextForHomeTeam(homeTeamId?: string | null): VenueContext {
  const venue = homeTeamId ? NFL_STADIUMS[homeTeamId] : undefined,
    roofType = venue?.roofType ?? 'UNKNOWN',
    environment = environmentForRoof(roofType);
  return {
    stadium: venue?.stadium ?? null,
    roofType,
    environment,
    statusKnown: environment !== 'UNKNOWN',
  };
}
export function venueContextForHistoricalGame(game: HistoricalPlayerGame): VenueContext {
  // Early Eastern kickoffs are normally international/neutral-site games. With
  // no game-level venue in the imported schema, exclude rather than guess.
  if (game.kickoffAt) {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(game.kickoffAt))
        .find((part) => part.type === 'hour')?.value,
    );
    if (hour < 11) return venueContextForHomeTeam(null);
  }
  return venueContextForHomeTeam(game.homeTeamId);
}
