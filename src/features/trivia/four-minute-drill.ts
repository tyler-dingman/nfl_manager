export const DRILL_QUESTION_COUNT = 10;
export const DRILL_PLAY_CLOCK_SECONDS = 24;
export const DRILL_GAME_CLOCK_SECONDS = 4 * 60;
export const DRILL_YARDS_PER_CORRECT_ANSWER = 10;

export function getDrillYards(correct: boolean) {
  return correct ? DRILL_YARDS_PER_CORRECT_ANSWER : 0;
}

export type DrillStanding = {
  userId: string;
  score: number;
  correctAnswers: number;
  responseTimeTotalMs?: number;
};

export function getQuestionStartSeconds(questionNumber: number) {
  const position = Math.min(DRILL_QUESTION_COUNT, Math.max(1, Math.floor(questionNumber)));
  return DRILL_GAME_CLOCK_SECONDS - (position - 1) * DRILL_PLAY_CLOCK_SECONDS;
}

export function getDrillGameSeconds(
  questionNumber: number,
  playClockSeconds: number,
  playComplete = false,
) {
  const start = getQuestionStartSeconds(questionNumber);
  if (playComplete) return Math.max(0, start - DRILL_PLAY_CLOCK_SECONDS);
  const playClock = Math.min(DRILL_PLAY_CLOCK_SECONDS, Math.max(0, Math.floor(playClockSeconds)));
  return Math.max(0, start - (DRILL_PLAY_CLOCK_SECONDS - playClock));
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
