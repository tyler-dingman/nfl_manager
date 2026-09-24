import { loadEnvConfig } from '@next/env';

async function main() {
  loadEnvConfig(process.cwd());
  const { syncVerifiedVideoSources, VERIFIED_VIDEO_SOURCES } =
    await import('../src/server/film-room/video-source-sync');
  const { sourceById } = await import('../src/server/story-engine/repository');
  const { processSource } = await import('../src/server/story-engine/service');
  const { loadDiscoveredFilmRoomVideos } = await import('../src/server/film-room/discovered');
  const { authDb } = await import('../src/server/auth/database');
  try {
    await syncVerifiedVideoSources();
    let failed = 0;
    for (const [team, id, name] of VERIFIED_VIDEO_SOURCES) {
      try {
        const source = await sourceById(id);
        if (!source) throw new Error('Registered source not found');
        const result = await processSource(source);
        console.log(JSON.stringify({ team, source: name, ...result }));
      } catch (error) {
        failed++;
        console.error(
          JSON.stringify({
            team,
            source: name,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
    const coverage = [];
    for (const team of new Set(VERIFIED_VIDEO_SOURCES.flatMap(([team]) => (team ? [team] : [])))) {
      coverage.push({ team, videos: (await loadDiscoveredFilmRoomVideos(team)).length });
    }
    console.table(coverage);
    if (failed || coverage.some(({ videos }) => !videos)) process.exitCode = 1;
  } finally {
    await authDb().end();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
