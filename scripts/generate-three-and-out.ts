import { loadEnvConfig } from '@next/env';

const valueAfter = (flag: string) => {
  const inline = process.argv.find((argument) => argument.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

async function main() {
  loadEnvConfig(process.cwd());
  const teamId = valueAfter('--team')?.toUpperCase();
  const service = await import('../src/server/three-and-out/daily-service');
  const result = teamId
    ? [
        {
          teamId,
          generated: Boolean(await service.generateDailyThreeAndOut(teamId, { force: true })),
        },
      ]
    : await service.generateAllDailyThreeAndOut({ force: true });
  console.table(result);
  if (result.some((item) => !item.generated)) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
