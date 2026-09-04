import { loadEnvConfig } from '@next/env';

async function main() {
  loadEnvConfig(process.cwd());
  const { buildThreeOutNarration } = await import('@/features/three-and-out/catch-up-audio');
  const { getThreeAndOutPackage } = await import('@/features/three-and-out/data');
  const { generateChatterboxSegments } = await import('@/server/three-and-out/chatterbox');

  const teamId = (process.argv[2] ?? 'KC').toUpperCase();
  const snapshot = getThreeAndOutPackage(teamId).current;
  const items = snapshot.stories.map((story) => ({
    id: story.id,
    storyId: story.id,
    teamId,
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
  const narration = buildThreeOutNarration(teamId, snapshot.teamName, items);
  if (!narration) throw new Error('Three current stories are required.');
  const result = await generateChatterboxSegments(narration);
  console.log(
    JSON.stringify(
      {
        provider: result.provider,
        voiceVersion: result.voiceVersion,
        segments: result.segments.map((segment) => ({
          storyId: segment.storyId,
          durationMs: segment.durationMs,
          audioUrl: segment.audioUrl,
        })),
      },
      null,
      2,
    ),
  );
}

void main();
