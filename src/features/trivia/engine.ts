import type { TriviaAnswerChoice } from './types';

export const TRIVIA_TOTAL_TIME_MS = 20_000;

export function calculateTriviaPoints(
  correct: boolean,
  responseTimeMs: number,
  totalTimeMs = TRIVIA_TOTAL_TIME_MS,
) {
  if (!correct || responseTimeMs >= totalTimeMs) return 0;
  const remainingWholeSeconds = Math.floor(
    Math.max(0, totalTimeMs - Math.max(0, responseTimeMs)) / 1000,
  );
  return 20 + remainingWholeSeconds;
}

export function scoreAnswer(
  correctAnswer: TriviaAnswerChoice,
  selectedAnswer: TriviaAnswerChoice | null,
  responseTimeMs: number,
  totalTimeMs = TRIVIA_TOTAL_TIME_MS,
) {
  const correct = selectedAnswer === correctAnswer;
  return { correct, points: calculateTriviaPoints(correct, responseTimeMs, totalTimeMs) };
}

export function selectDailyQuestion<T extends { id: string }>(
  questions: T[],
  teamId: string,
  date: string,
) {
  if (!questions.length) return null;
  const seed = `${teamId.toUpperCase()}:${date}`;
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return questions[hash % questions.length];
}

export function awardMoveTheChains(
  currentDriveYards: number,
  touchdowns: number,
  lifetimeYards: number,
  yards: number,
) {
  const total = currentDriveYards + Math.max(0, yards);
  return {
    currentDriveYards: total % 100,
    touchdowns: touchdowns + Math.floor(total / 100),
    lifetimeYards: lifetimeYards + Math.max(0, yards),
  };
}
