export const DRILL_QUESTION_COUNT = 10;
export const DRILL_PLAY_CLOCK_SECONDS = 24;
export const DRILL_GAME_CLOCK_SECONDS = 4 * 60;
export const DRILL_YARDS_PER_CORRECT_ANSWER = 10;

export type DrillStanding = {
  userId: string;
  score: number;
  correctAnswers: number;
  responseTimeTotalMs?: number;
};

export function getDrillGameSecondsRemaining(
  responseTimeTotalMs: number,
  currentQuestionElapsedMs = 0,
) {
  return Math.max(
    0,
    DRILL_GAME_CLOCK_SECONDS -
      Math.floor((Math.max(0, responseTimeTotalMs) + Math.max(0, currentQuestionElapsedMs)) / 1000),
  );
}

export function rankDrillStandings<T extends DrillStanding>(rows: T[]) {
  return [...rows].sort(
    (a, b) =>
      b.score - a.score ||
      b.correctAnswers - a.correctAnswers ||
      (a.responseTimeTotalMs ?? Number.MAX_SAFE_INTEGER) -
        (b.responseTimeTotalMs ?? Number.MAX_SAFE_INTEGER) ||
      a.userId.localeCompare(b.userId),
  );
}

export function formatDrillClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
