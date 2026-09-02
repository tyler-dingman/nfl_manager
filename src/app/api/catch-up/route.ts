import { NextRequest, NextResponse } from 'next/server';

import { TEAM_LIST } from '@/data/teams';
import {
  buildCatchUpItems,
  buildContentCatchUpItems,
  isCatchUpEligible,
  snapshotStoryStates,
} from '@/features/catch-up/engine';
import type { CatchUpItem, CatchUpResponse, CatchUpStoryState } from '@/features/catch-up/types';
import { getThreeAndOutPackage } from '@/features/three-and-out/data';
import { canonicalThreeAndOut } from '@/server/content/canonical-surfaces';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { contentSnapshotId, loadTeamBriefings } from '@/server/content/team-briefings';
import { listContentState, recordCatchUpVisit } from '@/server/user/content-repository';

export const dynamic = 'force-dynamic';

const demoItems = (teamId: string, stories: CatchUpStoryState[], count: number): CatchUpItem[] =>
  stories.slice(0, count).map((story, index) => ({
    id: `${story.id}:demo-${index}`,
    storyId: story.id,
    teamId,
    type: index === 2 ? 'RESOLVED' : index === 0 ? 'CHANGED' : 'NEW',
    headline: story.title,
    summary: story.summary,
    whatChanged:
      index === 2
        ? 'A previously uncertain development now has a clear outcome.'
        : index === 0
          ? 'New material information changed the current understanding of this story.'
          : 'A meaningful new development entered the team picture.',
    whyItMatters: story.whyItMatters,
    occurredAt: story.lastMaterialUpdateAt,
    importanceScore: story.importanceScore,
    sourceCount: story.sourceCount,
    sources: story.sources,
    currentStoryStatus: index === 2 ? 'RESOLVED' : story.status,
  }));

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const teamId = (request.nextUrl.searchParams.get('team') ?? '').toUpperCase();
  const team = TEAM_LIST.find((candidate) => candidate.abbr === teamId);
  if (!team) return NextResponse.json({ error: 'A valid team is required.' }, { status: 400 });

  const briefings = await loadTeamBriefings(teamId);
  const snapshot =
    (await canonicalThreeAndOut(teamId))?.current ?? getThreeAndOutPackage(teamId).current;
  const currentSnapshotId = contentSnapshotId(teamId, briefings);
  const currentState = snapshotStoryStates(snapshot);
  const visit = await recordCatchUpVisit({
    userId: user.id,
    teamId,
    snapshotId: currentSnapshotId,
    storyState: currentState,
  });
  const baselineAt = new Date(visit.state.lastCaughtUpAt ?? visit.state.firstSeenAt).toISOString();
  const consumed = await listContentState(
    user.id,
    briefings.map((briefing) => briefing.id),
  );
  const consumedVersions = new Map(
    consumed
      .filter((state) => state.firstViewedAt || state.completedAt)
      .map((state) => [
        String(state.contentId),
        state.mediaVersion ? String(state.mediaVersion) : null,
      ]),
  );
  const contentItems = buildContentCatchUpItems({
    teamId,
    briefings,
    baselineAt,
    consumedVersions,
  });
  const storyComparison = buildCatchUpItems({
    teamId,
    baseline: visit.state.caughtUpStoryState,
    current: currentState,
    baselineAt,
  });
  const items = storyComparison.items.length ? storyComparison.items : contentItems;
  const eligible = isCatchUpEligible(visit.firstVisit, visit.state.visitCount);
  const response: CatchUpResponse = {
    eligible,
    teamId,
    teamName: team.name,
    baselineAt,
    currentSnapshotId,
    mode: storyComparison.mode,
    items: eligible ? items : [],
    totalMeaningfulChanges: eligible ? items.length : 0,
    estimatedReadMinutes: Math.max(1, Math.ceil(items.length * 0.45)),
  };

  if (process.env.NODE_ENV !== 'production') {
    const demo = request.nextUrl.searchParams.get('demo');
    if (demo === 'first')
      return NextResponse.json({ ok: true, catchUp: { ...response, eligible: false, items: [] } });
    if (demo === 'none')
      return NextResponse.json({
        ok: true,
        catchUp: { ...response, eligible: true, items: [], totalMeaningfulChanges: 0 },
      });
    if (demo === 'one' || demo === 'multiple' || demo === 'resolved') {
      const items = demoItems(
        teamId,
        currentState,
        demo === 'multiple' ? 3 : demo === 'resolved' ? 3 : 1,
      );
      const selected = demo === 'resolved' ? [items[2]] : items;
      return NextResponse.json({
        ok: true,
        catchUp: {
          ...response,
          eligible: true,
          items: selected,
          totalMeaningfulChanges: selected.length,
          estimatedReadMinutes: Math.max(1, Math.ceil(selected.length * 0.45)),
        },
      });
    }
  }
  return NextResponse.json({ ok: true, catchUp: response });
}
