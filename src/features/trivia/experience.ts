export type TriviaExperiencePhase = 'QUESTION' | 'LOCKED' | 'REVEAL' | 'STANDINGS' | 'COMPLETE';

export const MAX_BUDDY_PLAYERS = 5;

export type TriviaRecapPlayer = {
  userId: string;
  name: string;
  score: number;
  correctAnswers: number;
};

export function canSubmitTriviaAnswer(phase: TriviaExperiencePhase) {
  return phase === 'QUESTION';
}

export function nextTriviaPhase(
  phase: TriviaExperiencePhase,
  gameCompleted = false,
): TriviaExperiencePhase {
  if (phase === 'QUESTION') return 'LOCKED';
  if (phase === 'LOCKED') return 'REVEAL';
  if (phase === 'REVEAL') return 'STANDINGS';
  if (phase === 'STANDINGS') return gameCompleted ? 'COMPLETE' : 'QUESTION';
  return 'COMPLETE';
}

export function getLeaderboardMovement(previousRank: number | null, currentRank: number) {
  if (previousRank === null || previousRank === currentRank) return 0;
  return previousRank - currentRank;
}

export function rankTriviaPlayers<T extends TriviaRecapPlayer>(players: T[]) {
  return [...players].sort(
    (a, b) =>
      b.score - a.score ||
      b.correctAnswers - a.correctAnswers ||
      a.name.localeCompare(b.name) ||
      a.userId.localeCompare(b.userId),
  );
}

export function buildTriviaRecap<T extends TriviaRecapPlayer>(players: T[]) {
  const ranked = rankTriviaPlayers(players);
  return {
    ranked,
    winner: ranked[0] ?? null,
    biggestLoser: ranked[ranked.length - 1] ?? null,
  };
}

export function canStartBuddyRoom(joinedPlayers: number) {
  return joinedPlayers >= 2 && joinedPlayers <= MAX_BUDDY_PLAYERS;
}
