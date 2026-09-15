import { loadEnvConfig } from '@next/env';

async function main() {
  loadEnvConfig(process.cwd());
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.replace(/^--/, '').split('=');
      return [key, value ?? 'true'];
    }),
  );
  const seasons = String(args.seasons ?? args.season ?? '2024,2025')
    .split(',')
    .map(Number)
    .filter(Number.isInteger);
  if (!seasons.length) throw new Error('Use --seasons=2024,2025 or --season=2025');
  const { importNflverseHistory } = await import('../src/server/historical-stats/importer');
  const summary = await importNflverseHistory({
    seasons,
    week: args.week ? Number(args.week) : undefined,
    playersOnly: args['players-only'] === 'true',
    teamsOnly: args['teams-only'] === 'true',
    force: args.force === 'true',
    dryRun: args['dry-run'] === 'true',
  });
  console.table({
    'Games imported': summary.games,
    'Player rows imported': summary.playerRows,
    'Team-game rows imported': summary.teamRows,
    'Player rows mapped': summary.mappedPlayers,
    'Players unmatched': summary.unmatchedPlayers,
    Errors: summary.errors,
    'Dry run': summary.dryRun,
    'Season strength records': Object.values(summary.strengthRecords ?? {}).reduce(
      (total, count) => total + count,
      0,
    ),
  });
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
