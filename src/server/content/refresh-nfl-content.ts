import { TEAM_LIST } from '@/data/teams';
import { assertNFLTeamCoverage } from '@/data/sources/monitoring';
import { GroundedDeterministicStorySynthesizer } from '@/features/story-engine/synthesis';
import { syncAllMonitoringRegistries, syncMonitoringRegistry } from '@/server/monitoring/observer';
import { drainJobs, scheduleDueSources } from '@/server/story-engine/service';
import { generateDailyThreeAndOut } from '@/server/three-and-out/daily-service';

export type RefreshNFLContentOptions = {
  teamIds?: string[];
  reason?: string;
  dryRun?: boolean;
  forceThreeAndOut?: boolean;
};

export async function refreshNFLContent(options: RefreshNFLContentOptions = {}) {
  assertNFLTeamCoverage();
  const teamIds = (options.teamIds?.length ? options.teamIds : TEAM_LIST.map((team) => team.abbr))
    .map((teamId) => teamId.toUpperCase())
    .filter((teamId, index, all) => all.indexOf(teamId) === index);
  const unknown = teamIds.filter((teamId) => !TEAM_LIST.some((team) => team.abbr === teamId));
  if (unknown.length) throw new Error(`Unknown NFL team(s): ${unknown.join(', ')}`);
  if (options.dryRun) {
    return {
      dryRun: true,
      reason: options.reason ?? 'MANUAL',
      teams: teamIds.map((teamId) => ({
        teamId,
        wouldSyncSources: true,
        wouldIngest: true,
        wouldGenerateThreeAndOut: true,
      })),
    };
  }
  if (teamIds.length === 32) await syncAllMonitoringRegistries();
  const results = [];
  for (const teamId of teamIds) {
    try {
      if (teamIds.length !== 32) await syncMonitoringRegistry(teamId);
      const scheduled = await scheduleDueSources(new Date(), teamId, 'standard');
      const jobs = await drainJobs(
        50,
        teamId,
        true,
        new GroundedDeterministicStorySynthesizer(),
        new Date(Date.now() - 72 * 3_600_000),
        10,
        'standard',
      );
      const failed = jobs.filter((job) => job.type === 'error');
      const generated = jobs.filter((job) =>
        ['created', 'updated', 'published'].includes(String(job.result?.action)),
      ).length;
      const threeAndOut = await generateDailyThreeAndOut(teamId, {
        force: options.forceThreeAndOut || generated > 0 || options.reason === 'GAME_FINAL',
      });
      results.push({
        teamId,
        ok: failed.length === 0,
        scheduled,
        jobs: jobs.length,
        generated,
        threeAndOut: Boolean(threeAndOut),
        failures: failed.map((job) => String(job.error)),
      });
    } catch (error) {
      results.push({
        teamId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    dryRun: false,
    reason: options.reason ?? 'MANUAL',
    teams: results,
    failures: results.filter((result) => !result.ok).length,
  };
}
