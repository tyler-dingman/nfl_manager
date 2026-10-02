import { NextResponse } from 'next/server';
import { getPublicStoryById } from '@/server/story-engine/projections';
import { getContentDetail } from '@/server/content/content-detail';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const story = await getPublicStoryById(params.id);
  if (story)
    return NextResponse.json({
      id: story.id,
      title: story.headline,
      teamId: story.teamId,
      summary: story.whatHappened || story.shortSummary,
      whyItMatters: story.whyItMatters,
      whatsNext: story.whatsNext,
      status: story.status,
      storyType: story.storyType,
      importanceScore: story.importanceScore,
      lastMaterialUpdateAt: story.lastMeaningfulUpdateAt,
      sources: story.sources.map((source) => ({
        id: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        isOfficialSource: source.official,
      })),
    });
  const briefing = await getContentDetail(params.id);
  if (!briefing) return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
  return NextResponse.json({
    id: briefing.id,
    title: briefing.headline,
    teamId: briefing.teamAbbr,
    summary: briefing.summary,
    whyItMatters: briefing.whyItMatters ?? '',
    whatsNext: '',
    status: briefing.status ?? briefing.category,
    importanceScore: 0,
    lastMaterialUpdateAt: briefing.updatedAt,
    sources: briefing.sources.map((source) => ({
      id: source.id,
      sourceName: source.publisher,
      sourceUrl: source.url,
      isOfficialSource: source.kind === 'official',
    })),
  });
}
