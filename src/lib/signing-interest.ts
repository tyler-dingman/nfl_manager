import type { PlayerRowDTO } from '@/types/player';

export type PlayerInterestContext = {
  teamAbbr: string;
  teamRoster: PlayerRowDTO[];
  previousTeamAbbr?: string | null;
  lastContractTeamAbbr?: string | null;
};

export type PlayerInterestBreakdown = {
  baseInterest: number;
  previousTeamBoost: number;
  opportunityBoost: number;
  veteranBoost: number;
  finalInterest: number;
  modifiers: string[];
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const calculatePlayerInterestForTeam = (
  player: Pick<PlayerRowDTO, 'position' | 'age' | 'rating'>,
  context: PlayerInterestContext,
): PlayerInterestBreakdown => {
  const baseInterest = 45;
  const modifiers: string[] = [];
  const normalizedTeamAbbr = context.teamAbbr.toUpperCase();

  const previousTeam = (
    context.lastContractTeamAbbr ??
    context.previousTeamAbbr ??
    ''
  ).toUpperCase();
  const previousTeamBoost = previousTeam.length > 0 && previousTeam === normalizedTeamAbbr ? 14 : 0;
  if (previousTeamBoost > 0) {
    modifiers.push('Previous team familiarity');
  }

  const playerRating = player.rating ?? 0;
  const highestAtPosition = context.teamRoster
    .filter((teammate) => teammate.position === player.position)
    .reduce((highest, teammate) => Math.max(highest, teammate.rating ?? 0), 0);
  const ratingGap = playerRating - highestAtPosition;
  const opportunityBoost = ratingGap > 0 ? clamp(Math.round(ratingGap * 1.5), 4, 20) : 0;
  if (opportunityBoost > 0) {
    modifiers.push('Starting opportunity');
  }

  const age = player.age ?? 27;
  let veteranBoost = 0;
  if (age >= 35) veteranBoost = 10;
  else if (age >= 32) veteranBoost = 7;
  else if (age >= 30) veteranBoost = 4;
  if (veteranBoost > 0) {
    modifiers.push('Veteran preference');
  }

  const finalInterest = clamp(
    Math.round(baseInterest + previousTeamBoost + opportunityBoost + veteranBoost),
    0,
    100,
  );

  return {
    baseInterest,
    previousTeamBoost,
    opportunityBoost,
    veteranBoost,
    finalInterest,
    modifiers,
  };
};
