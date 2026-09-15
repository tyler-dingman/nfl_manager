import { loadEnvConfig } from '@next/env';

const value = (name: string) => {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

async function main() {
  loadEnvConfig(process.cwd());
  const team = value('--team')?.toUpperCase();
  const { refreshNFLContent } = await import('../src/server/content/refresh-nfl-content');
  const result = await refreshNFLContent({
    teamIds: team ? team.split(',') : undefined,
    reason: value('--reason') ?? 'MANUAL_CLI',
    dryRun: process.argv.includes('--dry-run'),
    forceThreeAndOut: process.argv.includes('--force-three-out'),
  });
  console.log(JSON.stringify(result, null, 2));
  if ('failures' in result && result.failures) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
