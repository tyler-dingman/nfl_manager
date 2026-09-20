import type { HistoricalPlayerGame, HistoricalStatType } from './types';

/** Summarize the latest stored regular season; missing fields stay unavailable. */
export function researchSeasonStats(
  logs: HistoricalPlayerGame[],
  stat: HistoricalStatType,
  position?: string,
) {
  const regular = logs.filter((g) => g.seasonType === 'REG');
  if (!regular.length) return null;
  const season = Math.max(...regular.map((g) => g.season));
  const games = regular.filter((g) => g.season === season);
  type Field = keyof Pick<
    HistoricalPlayerGame,
    | 'passingAttempts'
    | 'passingCompletions'
    | 'passingYards'
    | 'passingTds'
    | 'interceptions'
    | 'carries'
    | 'rushingYards'
    | 'rushingTds'
    | 'targets'
    | 'receptions'
    | 'receivingYards'
    | 'receivingTds'
  >;
  const format = (value: number | null) => (value == null ? '—' : value.toFixed(1));
  const mean = (key: Field) => {
    const values = games
      .map((g) => g[key])
      .filter((v): v is number => v != null && Number.isFinite(v));
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const ratio = (a: Field, b: Field, factor = 1) => {
    const paired = games.filter((g) => g[a] != null && g[b] != null);
    const denominator = paired.reduce((sum, g) => sum + g[b]!, 0);
    return denominator ? (factor * paired.reduce((sum, g) => sum + g[a]!, 0)) / denominator : null;
  };
  const item = (label: string, key: Field) => ({ label, value: format(mean(key)) });
  const items =
    stat.startsWith('PASSING') ||
    stat === 'INTERCEPTIONS' ||
    (stat === 'ANYTIME_TD' && position === 'QB')
      ? [
          {
            label: 'Completion %',
            value:
              ratio('passingCompletions', 'passingAttempts') == null
                ? '—'
                : `${format(ratio('passingCompletions', 'passingAttempts', 100))}%`,
          },
          item('Pass yards / game', 'passingYards'),
          item('Attempts / game', 'passingAttempts'),
          item('Pass TD / game', 'passingTds'),
          item('INT / game', 'interceptions'),
        ]
      : stat.startsWith('RUSH') || (stat === 'ANYTIME_TD' && ['RB', 'FB'].includes(position ?? ''))
        ? [
            item('Rush yards / game', 'rushingYards'),
            { label: 'Yards / carry', value: format(ratio('rushingYards', 'carries')) },
            item('Carries / game', 'carries'),
            item('Rush TD / game', 'rushingTds'),
            item('Receptions / game', 'receptions'),
          ]
        : [
            item('Targets / game', 'targets'),
            item('Receptions / game', 'receptions'),
            item('Rec yards / game', 'receivingYards'),
            item('Rec TD / game', 'receivingTds'),
            item('Rush yards / game', 'rushingYards'),
          ];
  return { season, items };
}
