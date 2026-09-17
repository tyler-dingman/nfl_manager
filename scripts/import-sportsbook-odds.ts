import { loadEnvConfig } from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

async function main() {
  loadEnvConfig(process.cwd());
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
  );
  const production = args.database === 'production';
  if (production) {
    if (!Object.prototype.hasOwnProperty.call(args, 'confirm-production')) {
      throw new Error(
        'Production import refused. Add --database=production --confirm-production after reviewing the audit.',
      );
    }
    if (!process.env.PRODUCTION_DATABASE_URL) {
      throw new Error('PRODUCTION_DATABASE_URL is required');
    }
    process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;
  }
  console.log(`Environment: ${production ? 'production' : 'local'}`);
  const { SportsbookIngestionService } =
    await import('../src/server/odds/sportsbookIngestionService');
  const season = Number(args.season);
  const week = Number(args.week);
  if (!Number.isInteger(season) || !Number.isInteger(week)) {
    throw new Error('Usage: npm run odds:import -- --season=2026 --week=2');
  }

  const summary = await new SportsbookIngestionService().importNflWeek(season, week);
  console.table({
    'Events imported': summary.eventsImported,
    'Markets imported': summary.marketsImported,
    ...Object.fromEntries(
      Object.entries(summary.pricesBySportsbook).map(([book, count]) => [`${book} prices`, count]),
    ),
    'Alt lines': summary.altLines,
    Deeplinks: summary.deeplinks,
    'Unmapped players': summary.unmappedPlayers.length,
  });
  if (summary.unmappedPlayers.length) {
    console.warn('Unmapped player IDs:', summary.unmappedPlayers.join(', '));
  }
  const reportPath = path.join(process.cwd(), 'reports', 'unmapped-nfl-markets.csv');
  await mkdir(path.dirname(reportPath), { recursive: true });
  const headers = [
    'providerEventId',
    'providerMarketId',
    'providerMarketName',
    'statId',
    'entityId',
    'period',
    'side',
    'line',
    'normalizationStatus',
  ];
  await writeFile(
    reportPath,
    [
      headers.join(','),
      ...summary.unmappedMarkets.map((market) =>
        headers.map((header) => csvCell(market[header as keyof typeof market])).join(','),
      ),
    ].join('\n'),
  );
  console.info(`Unmapped market report: ${reportPath}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
