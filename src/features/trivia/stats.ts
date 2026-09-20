export type TriviaStats = {
  lifetimePoints: number;
  weeklyPoints: number;
  questionsAnswered: number;
  correctAnswers: number;
  gamesPlayed: number;
  currentStreak: number;
  bestStreak: number;
  accuracy: number;
};

// PostgreSQL numeric values can arrive as strings. Normalize at both boundaries:
// the repository's JSON contract and clients receiving older/cached responses.
export function normalizeTriviaStats(value: unknown): TriviaStats {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const number = (key: string) => {
    const raw = row[key];
    const parsed = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };
  return {
    lifetimePoints: number('lifetimePoints'),
    weeklyPoints: number('weeklyPoints'),
    questionsAnswered: number('questionsAnswered'),
    correctAnswers: number('correctAnswers'),
    gamesPlayed: number('gamesPlayed'),
    currentStreak: number('currentStreak'),
    bestStreak: number('bestStreak'),
    accuracy: Math.min(100, number('accuracy')),
  };
}
