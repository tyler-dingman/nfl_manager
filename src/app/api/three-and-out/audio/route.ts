import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { TEAM_LIST } from '@/data/teams';
import type { CatchUpItem } from '@/features/catch-up/types';
import { buildThreeOutNarration } from '@/features/three-and-out/catch-up-audio';
import { getThreeAndOutPackage } from '@/features/three-and-out/data';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { canonicalThreeAndOut } from '@/server/content/canonical-surfaces';
import { loadTeamBriefings } from '@/server/content/team-briefings';
import { generateChatterboxSegments } from '@/server/three-and-out/chatterbox';

const schema = z.object({
  teamId: z
    .string()
    .trim()
    .min(2)
    .max(3)
    .transform((value) => value.toUpperCase()),
  storyIds: z.array(z.string().min(1).max(160)).length(3),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    if ((process.env.THREE_OUT_TTS_PROVIDER ?? 'browser') !== 'chatterbox')
      return NextResponse.json({ provider: 'browser', segments: [] });
    const input = schema.parse(await request.json());
    const team = TEAM_LIST.find((candidate) => candidate.abbr === input.teamId);
    if (!team) return NextResponse.json({ error: 'Invalid team.' }, { status: 400 });
    if (input.teamId === 'KC') {
      return NextResponse.json({
        provider: 'recorded-poc',
        segments: [
          {
            audioUrl: '/api/three-and-out/audio/poc',
            sectionStartTimes: [0, 11.45, 23.1],
          },
        ],
      });
    }

    const [briefings, canonical] = await Promise.all([
      loadTeamBriefings(input.teamId),
      canonicalThreeAndOut(input.teamId),
    ]);
    const snapshot = canonical?.current ?? getThreeAndOutPackage(input.teamId).current;
    const allowed = new Map<string, CatchUpItem>();
    for (const story of [...snapshot.stories, ...snapshot.puntStories])
      allowed.set(story.id, {
        id: story.id,
        storyId: story.id,
        teamId: input.teamId,
        type: 'NEW',
        headline: story.title,
        summary: story.summary,
        whatChanged: null,
        whyItMatters: story.whyItMatters,
        occurredAt: story.lastMaterialUpdateAt,
        importanceScore: story.importanceScore,
        sourceCount: story.sourceCount,
        sources: story.sources,
        currentStoryStatus: story.status,
      });
    briefings.forEach((briefing, index) =>
      allowed.set(briefing.id, {
        id: briefing.id,
        storyId: briefing.id,
        teamId: input.teamId,
        type: 'NEW',
        headline: briefing.headline,
        summary: briefing.summary,
        whatChanged: null,
        whyItMatters: briefing.whyItMatters ?? '',
        occurredAt: briefing.updatedAt,
        importanceScore: 10_000 - index,
        sourceCount: briefing.sourceCount,
        sources: [],
        currentStoryStatus: 'DEVELOPING',
      }),
    );
    const stories = input.storyIds.map((id, index) => {
      const story = allowed.get(id);
      return story ? { ...story, importanceScore: 300 - index } : undefined;
    });
    if (stories.some((story) => !story))
      return NextResponse.json(
        { error: 'Story snapshot is no longer available.' },
        { status: 409 },
      );
    const narration = buildThreeOutNarration(input.teamId, team.name, stories as CatchUpItem[]);
    if (!narration)
      return NextResponse.json({ error: 'Three stories are required.' }, { status: 400 });
    return NextResponse.json(await generateChatterboxSegments(narration));
  } catch (error) {
    console.error('[THREE & OUT TTS] Chatterbox unavailable; browser fallback allowed.', error);
    return NextResponse.json({
      provider: 'browser',
      segments: [],
      fallbackReason: 'CHATTERBOX_UNAVAILABLE',
    });
  }
}
