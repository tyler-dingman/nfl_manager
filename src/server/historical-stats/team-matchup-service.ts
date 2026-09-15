import { authDb } from '@/server/auth/database';

type Context = 'PASSING_YARDS' | 'PASSING_TDS' | 'RUSHING_YARDS' | 'RUSHING_TDS' | 'RECEPTIONS';

export async function getTeamMatchupTrend(
  opponentTeamId: string,
  context: Context,
  seasons = [2024, 2025],
) {
  const rows = await authDb()<
    Array<{
      teamId: string;
      passingYards: number | null;
      passingTds: number | null;
      rushingYards: number | null;
      rushingTds: number | null;
      receptions: number | null;
    }>
  >`
  SELECT opponent_team_id AS "teamId", passing_yards AS "passingYards", passing_tds AS "passingTds",
    rushing_yards AS "rushingYards", rushing_tds AS "rushingTds", receptions
  FROM historical_team_games WHERE season=ANY(${seasons})`;
  const key = {
    PASSING_YARDS: 'passingYards',
    PASSING_TDS: 'passingTds',
    RUSHING_YARDS: 'rushingYards',
    RUSHING_TDS: 'rushingTds',
    RECEPTIONS: 'receptions',
  }[context] as keyof (typeof rows)[number];
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value === 'number')
      grouped.set(row.teamId, [...(grouped.get(row.teamId) ?? []), value]);
  }
  if (grouped.size < 32) return null;
  const summaries = [...grouped]
      .map(([teamId, values]) => ({
        teamId,
        average: values.reduce((a, b) => a + b, 0) / values.length,
        games: values.length,
      }))
      .sort((a, b) => a.average - b.average),
    found = summaries.find((r) => r.teamId === opponentTeamId);
  if (!found) return null;
  return {
    opponentTeamId,
    context,
    average: Math.round(found.average * 10) / 10,
    games: found.games,
    rank: summaries.findIndex((r) => r.teamId === opponentTeamId) + 1,
    teams: summaries.length,
  };
}
