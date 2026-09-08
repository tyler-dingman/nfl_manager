import { loadEnvConfig } from '@next/env';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { TEAM_LIST } from '@/data/teams';
import { buildThreeOutNarration } from '@/features/three-and-out/catch-up-audio';

type Manifest = Record<
  string,
  { cacheKey: string; storyIds: string[]; durationsMs: number[]; generatedAt: string }
>;

loadEnvConfig(process.cwd());

const root = process.cwd();
const publicRoot = path.join(root, 'public', 'audio', 'three-and-out');
const privateRoot = path.join(root, 'private', 'tts', 'cache');
const manifestPath = path.join(publicRoot, 'manifest.json');
const requested = process.argv.slice(2).map((team) => team.toUpperCase());
const teams = TEAM_LIST.filter(
  (team) => team.abbr !== 'KC' && (!requested.length || requested.includes(team.abbr)),
);

async function main() {
  if (process.env.PRODUCTION_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;
    console.log('Using PRODUCTION_DATABASE_URL for canonical Three & Out stories.');
  }
  const [{ canonicalThreeAndOut }, { getThreeAndOutPackage }, chatterbox] = await Promise.all([
    import('@/server/content/canonical-surfaces'),
    import('@/features/three-and-out/data'),
    import('@/server/three-and-out/chatterbox'),
  ]);
  const { generateChatterboxSegments, threeOutAudioCacheKey } = chatterbox;
  await mkdir(publicRoot, { recursive: true });
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
  for (const [index, team] of teams.entries()) {
    const canonical = await canonicalThreeAndOut(team.abbr);
    if (process.env.PRODUCTION_DATABASE_URL && !canonical)
      throw new Error(`${team.abbr} does not have three canonical production stories.`);
    const snapshot = canonical?.current ?? getThreeAndOutPackage(team.abbr).current;
    const items = snapshot.stories.map((story) => ({
      id: story.id,
      storyId: story.id,
      teamId: team.abbr,
      type: 'NEW' as const,
      headline: story.title,
      summary: story.summary,
      whatChanged: null,
      whyItMatters: story.whyItMatters,
      occurredAt: story.lastMaterialUpdateAt,
      importanceScore: story.importanceScore,
      sourceCount: story.sourceCount,
      sources: story.sources,
      currentStoryStatus: story.status,
    }));
    const narration = buildThreeOutNarration(team.abbr, snapshot.teamName, items);
    if (!narration) throw new Error(`${team.abbr} does not have three stories.`);
    const cacheKey = threeOutAudioCacheKey(narration);
    console.log(`[${index + 1}/${teams.length}] ${team.abbr} ${cacheKey}`);
    const generated = await generateChatterboxSegments(narration);
    const destination = path.join(publicRoot, team.abbr.toLowerCase(), cacheKey);
    await mkdir(destination, { recursive: true });
    for (let segment = 1; segment <= 3; segment += 1)
      await cp(
        path.join(privateRoot, cacheKey, `segment-${segment}.wav`),
        path.join(destination, `segment-${segment}.wav`),
      );
    manifest[team.abbr] = {
      cacheKey,
      storyIds: narration.segments.map((segment) => segment.storyId),
      durationsMs: generated.segments.map((segment) => segment.durationMs),
      generatedAt: new Date().toISOString(),
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
