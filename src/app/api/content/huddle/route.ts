import { NextResponse } from 'next/server';

import { TEAM_LIST } from '@/data/teams';
import { DEFAULT_BEAT_PAGE_SIZE, parseBeatPage } from '@/features/content/pagination';
import { listPublicStoryPage } from '@/server/story-engine/projections';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamAbbr = (url.searchParams.get('team') ?? 'NFL').toUpperCase();
  const team = TEAM_LIST.find((candidate) => candidate.abbr === teamAbbr);
  const teamName = team?.name ?? 'NFL';
  const page = parseBeatPage(url.searchParams.get('page'));
  const filter = (url.searchParams.get('type') ?? 'ALL').toUpperCase();
  const timeRange = (url.searchParams.get('range') ?? 'ALL').toUpperCase();
  const sort = (url.searchParams.get('sort') ?? 'UPDATED').toUpperCase();
  const query = url.searchParams.get('q') ?? '';
  const allowedFilters = ['ALL', 'HOT', 'ROSTER', 'INJURIES', 'DRAFT', 'GAMES'] as const;
  const allowedRanges = ['TODAY', 'WEEK', 'MONTH', 'ALL'] as const;
  const allowedSorts = ['UPDATED', 'NEWEST'] as const;

  try {
    const result = await listPublicStoryPage(teamAbbr, {
      page,
      pageSize: DEFAULT_BEAT_PAGE_SIZE,
      query,
      filter: allowedFilters.includes(filter as (typeof allowedFilters)[number])
        ? (filter as (typeof allowedFilters)[number])
        : 'ALL',
      timeRange: allowedRanges.includes(timeRange as (typeof allowedRanges)[number])
        ? (timeRange as (typeof allowedRanges)[number])
        : 'ALL',
      sort: allowedSorts.includes(sort as (typeof allowedSorts)[number])
        ? (sort as (typeof allowedSorts)[number])
        : 'UPDATED',
    });
    const briefings = result.stories.map((story) => ({
      id: story.id,
      teamAbbr: story.teamId,
      category: story.storyType,
      headline: story.headline,
      summary: story.shortSummary,
      whatHappened: story.whatHappened,
      whyItMatters: story.whyItMatters,
      whatsNext: story.whatsNext,
      updatedAt: story.lastMeaningfulUpdateAt,
      sourceCount: story.sources.length,
      status: story.status,
      materialUpdateCount: Math.max(0, story.version - 1),
      hotReadUntil: story.hotReadUntil ?? null,
      firstReportedBy: story.sources.find((source) => source.original)?.name ?? null,
      sources: story.sources.map((source) => ({
        id: source.id,
        publisher: source.name,
        title: story.headline,
        url: source.url,
        publishedAt: source.publishedAt,
        kind: source.official ? ('official' as const) : ('reporting' as const),
      })),
    }));
    return NextResponse.json({
      teamAbbr,
      teamName,
      briefings,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('[content-engine] failed to build briefings', error);
    return NextResponse.json({ error: 'Unable to build team briefings.' }, { status: 500 });
  }
}
