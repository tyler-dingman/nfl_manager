import { loadEnvConfig } from '@next/env';
import { normalizePlayerName } from '../src/server/ingest/normalize';

async function main() {
  loadEnvConfig(process.cwd());
  const { authDb } = await import('../src/server/auth/database');
  const { parseCsv } = await import('../src/server/historical-stats/importer');
  const seasons = (
    process.argv.find((a) => a.startsWith('--seasons='))?.slice(10) ??
    String(new Date().getFullYear())
  )
    .split(',')
    .map(Number);
  if (seasons.some((s) => !Number.isInteger(s) || s < 2012 || s > new Date().getFullYear()))
    throw new Error('Invalid seasons');
  const db = authDb();
  try {
    for (const season of seasons) {
      const response = await fetch(
        `https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_${season}.csv`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (!response.ok) throw new Error(`Snap feed ${season}: HTTP ${response.status}`);
      const rows = parseCsv(await response.text());
      const stored = await db<
        { gameId: string; providerGame: string; name: string; providerId: string; team: string }[]
      >`SELECT h.game_id AS "gameId",g.provider_game_id AS "providerGame",h.provider_player_name AS name,h.provider_player_id AS "providerId",h.team_id AS team
        FROM historical_player_games h JOIN historical_games g ON g.id=h.game_id WHERE h.season=${season}`;
      let imported = 0,
        unmatched = 0;
      for (const row of rows) {
        if (!['QB', 'RB', 'WR', 'TE'].includes(row.position)) continue;
        const team =
          ({ LA: 'LAR', JAC: 'JAX', WSH: 'WAS' } as Record<string, string>)[row.team] ?? row.team;
        const matches = stored.filter(
          (g) =>
            g.providerGame === row.game_id &&
            g.team === team &&
            normalizePlayerName(g.name) === normalizePlayerName(row.player),
        );
        const share = Number(row.offense_pct),
          snaps = Number(row.offense_snaps);
        if (
          matches.length !== 1 ||
          row.offense_pct === '' ||
          !Number.isFinite(share) ||
          share < 0 ||
          share > 1 ||
          !Number.isInteger(snaps) ||
          snaps < 0
        ) {
          unmatched++;
          continue;
        }
        if (!process.argv.includes('--dry-run'))
          await db`UPDATE historical_player_games SET snap_count=${snaps},snap_share=${share},updated_at=now()
          WHERE game_id=${matches[0]!.gameId} AND provider_player_id=${matches[0]!.providerId}`;
        imported++;
      }
      console.log(
        JSON.stringify({ season, imported, unmatched, dryRun: process.argv.includes('--dry-run') }),
      );
    }
  } finally {
    await db.end();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
