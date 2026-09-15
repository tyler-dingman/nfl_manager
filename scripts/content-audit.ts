import { loadEnvConfig } from '@next/env';

const age = (value: string | null, now: Date) => {
  if (!value) return 'never';
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(value).getTime()) / 60_000));
  return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
};

async function main() {
  loadEnvConfig(process.cwd());
  const { auditContentHealth } = await import('../src/server/content/content-health');
  const now = new Date();
  const report = await auditContentHealth(now);
  console.log('\nCONTENT HEALTH\n');
  for (const team of report.teams) {
    console.log(
      `${team.teamId.padEnd(3)} Sources ${String(team.enabledSources).padStart(2)}/${String(team.configuredSources).padEnd(2)} | fetch ${age(team.lastSuccessAt, now).padEnd(9)} | story ${age(team.latestStoryAt, now).padEnd(9)} | Beat ${String(team.beatStoriesToday).padStart(2)} | Home ${String(team.homepageCandidates).padStart(2)} | 3&Out ${team.threeAndOutReady ? 'READY' : 'MISSING'} | ${team.status}/${team.contentNote}`,
    );
    for (const warning of team.warnings) console.log(`    WARN ${warning}`);
  }
  console.log('\nTOTALS');
  console.table(report.totals);
  if (report.totals.misconfigured || report.totals.failed) process.exitCode = 1;
}

void main().catch((error) => {
  console.error('Content audit failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
