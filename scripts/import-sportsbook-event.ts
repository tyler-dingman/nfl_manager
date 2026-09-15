import { loadEnvConfig } from '@next/env';

async function main() {
  loadEnvConfig(process.cwd());
  const { SportsbookIngestionService } =
    await import('../src/server/odds/sportsbookIngestionService');
  const eventId = process.argv
    .find((arg) => arg.startsWith('--eventId='))
    ?.split('=')
    .slice(1)
    .join('=');
  if (!eventId) throw new Error('Usage: npm run odds:event -- --eventId=...');

  const summary = await new SportsbookIngestionService().importEvent(eventId);
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
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
