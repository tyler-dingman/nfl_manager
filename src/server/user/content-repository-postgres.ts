import { randomUUID } from 'node:crypto';

import { authDb } from '@/server/auth/database';
import { isNewVisit } from '@/features/catch-up/engine';
import type { CatchUpStoryState } from '@/features/catch-up/types';
import { awardYardsInTransaction } from '@/server/rewards/repository';

export type ContentType = 'STORY' | 'THREE_AND_OUT' | 'AUDIO' | 'VIDEO' | 'PODCAST' | 'OTHER';

export type ContentStateInput = {
  contentType: ContentType;
  contentId: string;
  mediaVersion?: string | null;
  progressSeconds?: number | null;
  durationSeconds?: number | null;
  completed?: boolean;
  viewed?: boolean;
};

const json = (value: Record<string, unknown>) => JSON.parse(JSON.stringify(value));

export async function listContentState(userId: string, contentIds?: string[]) {
  const sql = authDb();
  if (!contentIds?.length) {
    return sql<Array<Record<string, unknown>>>`
      SELECT content_type AS "contentType", content_id AS "contentId", media_version AS "mediaVersion",
        first_viewed_at AS "firstViewedAt", last_viewed_at AS "lastViewedAt", completed_at AS "completedAt",
        progress_seconds::float AS "progressSeconds", duration_seconds::float AS "durationSeconds", updated_at AS "updatedAt"
      FROM user_content_state WHERE user_id = ${userId} ORDER BY updated_at DESC`;
  }
  return sql<Array<Record<string, unknown>>>`
    SELECT content_type AS "contentType", content_id AS "contentId", media_version AS "mediaVersion",
      first_viewed_at AS "firstViewedAt", last_viewed_at AS "lastViewedAt", completed_at AS "completedAt",
      progress_seconds::float AS "progressSeconds", duration_seconds::float AS "durationSeconds", updated_at AS "updatedAt"
    FROM user_content_state WHERE user_id = ${userId} AND content_id = ANY(${contentIds}) ORDER BY updated_at DESC`;
}

export async function upsertContentState(userId: string, input: ContentStateInput) {
  const completedAt = input.completed ? new Date() : null;
  const viewedAt = input.viewed || input.completed ? new Date() : null;
  const rows = await authDb()<Array<{ id: string }>>`
    INSERT INTO user_content_state
      (id, user_id, content_type, content_id, media_version, first_viewed_at, last_viewed_at, completed_at, progress_seconds, duration_seconds)
    VALUES
      (${randomUUID()}, ${userId}, ${input.contentType}, ${input.contentId}, ${input.mediaVersion ?? null},
       ${viewedAt}, ${viewedAt}, ${completedAt}, ${input.progressSeconds ?? null}, ${input.durationSeconds ?? null})
    ON CONFLICT (user_id, content_type, content_id) DO UPDATE SET
      media_version = COALESCE(EXCLUDED.media_version, user_content_state.media_version),
      first_viewed_at = COALESCE(user_content_state.first_viewed_at, EXCLUDED.first_viewed_at),
      last_viewed_at = COALESCE(EXCLUDED.last_viewed_at, user_content_state.last_viewed_at),
      completed_at = COALESCE(EXCLUDED.completed_at, user_content_state.completed_at),
      progress_seconds = COALESCE(EXCLUDED.progress_seconds, user_content_state.progress_seconds),
      duration_seconds = COALESCE(EXCLUDED.duration_seconds, user_content_state.duration_seconds),
      updated_at = now()
    RETURNING id`;
  return rows[0] ?? null;
}

export async function listSavedContent(userId: string) {
  return authDb()<Array<Record<string, unknown>>>`
    SELECT id, content_type AS "contentType", content_id AS "contentId", title, href,
      image_url AS "imageUrl", metadata, created_at AS "createdAt"
    FROM user_saved_content WHERE user_id = ${userId} ORDER BY created_at DESC`;
}

export async function saveContent(
  userId: string,
  input: {
    contentType: ContentType;
    contentId: string;
    title: string;
    href?: string | null;
    imageUrl?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const metadata = input.metadata ? json(input.metadata) : {};
  const rows = await authDb()<Array<{ id: string }>>`
    INSERT INTO user_saved_content (id, user_id, content_type, content_id, title, href, image_url, metadata)
    VALUES (${randomUUID()}, ${userId}, ${input.contentType}, ${input.contentId}, ${input.title}, ${input.href ?? null}, ${input.imageUrl ?? null}, ${authDb().json(metadata)})
    ON CONFLICT (user_id, content_type, content_id) DO UPDATE SET title = EXCLUDED.title, href = EXCLUDED.href, image_url = EXCLUDED.image_url, metadata = EXCLUDED.metadata
    RETURNING id`;
  return rows[0] ?? null;
}

export async function unsaveContent(userId: string, contentType: ContentType, contentId: string) {
  await authDb()`DELETE FROM user_saved_content WHERE user_id = ${userId} AND content_type = ${contentType} AND content_id = ${contentId}`;
}

export async function getTeamVisitState(userId: string, teamId: string) {
  const rows = await authDb()<Array<Record<string, unknown>>>`
    SELECT team_id AS "teamId", last_visited_at AS "lastVisitedAt", last_seen_snapshot_id AS "lastSeenSnapshotId", updated_at AS "updatedAt"
    FROM user_team_visit_state WHERE user_id = ${userId} AND team_id = ${teamId}`;
  return rows[0] ?? null;
}

export async function updateTeamVisitState(userId: string, teamId: string, snapshotId: string) {
  const rows = await authDb()<Array<Record<string, unknown>>>`
    INSERT INTO user_team_visit_state (user_id, team_id, last_visited_at, last_seen_snapshot_id)
    VALUES (${userId}, ${teamId}, now(), ${snapshotId})
    ON CONFLICT (user_id, team_id) DO UPDATE SET last_visited_at = now(), last_seen_snapshot_id = EXCLUDED.last_seen_snapshot_id, updated_at = now()
    RETURNING team_id AS "teamId", last_visited_at AS "lastVisitedAt", last_seen_snapshot_id AS "lastSeenSnapshotId"`;
  return rows[0] ?? null;
}

export type CatchUpVisitState = {
  teamId: string;
  firstSeenAt: string | Date;
  lastVisitedAt: string | Date;
  currentVisitStartedAt: string | Date;
  visitCount: number;
  lastCaughtUpAt: string | Date | null;
  lastCaughtUpSnapshotId: string | null;
  caughtUpStoryState: CatchUpStoryState[];
};

export async function recordCatchUpVisit(input: {
  userId: string;
  teamId: string;
  snapshotId: string;
  storyState: CatchUpStoryState[];
  now?: Date;
}) {
  const sql = authDb();
  const now = input.now ?? new Date();
  return sql.begin(async (tx) => {
    const rows = await tx<CatchUpVisitState[]>`
      SELECT team_id AS "teamId", first_seen_at AS "firstSeenAt", last_visited_at AS "lastVisitedAt",
        current_visit_started_at AS "currentVisitStartedAt", visit_count AS "visitCount",
        last_caught_up_at AS "lastCaughtUpAt", last_caught_up_snapshot_id AS "lastCaughtUpSnapshotId",
        caught_up_story_state AS "caughtUpStoryState"
      FROM user_team_visit_state
      WHERE user_id = ${input.userId} AND team_id = ${input.teamId}
      FOR UPDATE`;
    const existing = rows[0];
    if (!existing || !existing.caughtUpStoryState?.length) {
      const created = await tx<CatchUpVisitState[]>`
        INSERT INTO user_team_visit_state
          (user_id, team_id, first_seen_at, last_visited_at, current_visit_started_at, visit_count,
           last_seen_snapshot_id, last_caught_up_at, last_caught_up_snapshot_id, caught_up_story_state)
        VALUES
          (${input.userId}, ${input.teamId}, ${now}, ${now}, ${now}, 1, ${input.snapshotId}, ${now},
           ${input.snapshotId}, ${tx.json(input.storyState)})
        ON CONFLICT (user_id, team_id) DO UPDATE SET
          first_seen_at = COALESCE(user_team_visit_state.first_seen_at, EXCLUDED.first_seen_at),
          last_visited_at = EXCLUDED.last_visited_at,
          current_visit_started_at = EXCLUDED.current_visit_started_at,
          visit_count = 1,
          last_seen_snapshot_id = EXCLUDED.last_seen_snapshot_id,
          last_caught_up_at = EXCLUDED.last_caught_up_at,
          last_caught_up_snapshot_id = EXCLUDED.last_caught_up_snapshot_id,
          caught_up_story_state = EXCLUDED.caught_up_story_state,
          updated_at = now()
        RETURNING team_id AS "teamId", first_seen_at AS "firstSeenAt", last_visited_at AS "lastVisitedAt",
          current_visit_started_at AS "currentVisitStartedAt", visit_count AS "visitCount",
          last_caught_up_at AS "lastCaughtUpAt", last_caught_up_snapshot_id AS "lastCaughtUpSnapshotId",
          caught_up_story_state AS "caughtUpStoryState"`;
      return { state: created[0], firstVisit: true, newVisit: true };
    }

    const startsNewVisit = isNewVisit(existing.lastVisitedAt, now);
    const updated = await tx<CatchUpVisitState[]>`
      UPDATE user_team_visit_state SET
        last_visited_at = ${now},
        last_seen_snapshot_id = ${input.snapshotId},
        current_visit_started_at = CASE WHEN ${startsNewVisit} THEN ${now} ELSE current_visit_started_at END,
        visit_count = visit_count + CASE WHEN ${startsNewVisit} THEN 1 ELSE 0 END,
        updated_at = now()
      WHERE user_id = ${input.userId} AND team_id = ${input.teamId}
      RETURNING team_id AS "teamId", first_seen_at AS "firstSeenAt", last_visited_at AS "lastVisitedAt",
        current_visit_started_at AS "currentVisitStartedAt", visit_count AS "visitCount",
        last_caught_up_at AS "lastCaughtUpAt", last_caught_up_snapshot_id AS "lastCaughtUpSnapshotId",
        caught_up_story_state AS "caughtUpStoryState"`;
    return { state: updated[0], firstVisit: false, newVisit: startsNewVisit };
  });
}

export async function completeCatchUp(input: {
  userId: string;
  teamId: string;
  snapshotId: string;
  storyState: CatchUpStoryState[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const rows = await authDb()<CatchUpVisitState[]>`
    UPDATE user_team_visit_state SET
      last_caught_up_at = ${now},
      last_caught_up_snapshot_id = ${input.snapshotId},
      caught_up_story_state = ${authDb().json(input.storyState)},
      updated_at = now()
    WHERE user_id = ${input.userId} AND team_id = ${input.teamId}
    RETURNING team_id AS "teamId", first_seen_at AS "firstSeenAt", last_visited_at AS "lastVisitedAt",
      current_visit_started_at AS "currentVisitStartedAt", visit_count AS "visitCount",
      last_caught_up_at AS "lastCaughtUpAt", last_caught_up_snapshot_id AS "lastCaughtUpSnapshotId",
      caught_up_story_state AS "caughtUpStoryState"`;
  return rows[0] ?? null;
}

export async function getPollVote(userId: string, questionId: string) {
  const rows = await authDb()<Array<{ optionId: string }>>`
    SELECT option_id AS "optionId" FROM user_poll_votes WHERE user_id = ${userId} AND question_id = ${questionId}`;
  return rows[0] ?? null;
}

export async function savePollVote(userId: string, questionId: string, optionId: string) {
  const rows = await authDb()<Array<{ optionId: string }>>`
    INSERT INTO user_poll_votes (id, user_id, question_id, option_id)
    VALUES (${randomUUID()}, ${userId}, ${questionId}, ${optionId})
    ON CONFLICT (user_id, question_id) DO NOTHING
    RETURNING option_id AS "optionId"`;
  return rows[0] ?? (await getPollVote(userId, questionId));
}

export async function createPrediction(
  userId: string,
  input: {
    predictionType: string;
    subjectType: string;
    subjectId: string;
    prediction: unknown;
    metadata?: Record<string, unknown>;
    lockedAt?: string | null;
  },
) {
  const prediction = JSON.parse(JSON.stringify(input.prediction));
  const metadata = input.metadata ? json(input.metadata) : {};
  return authDb().begin(async (tx) => {
    const id = randomUUID();
    const rows = await tx<Array<Record<string, unknown>>>`
      INSERT INTO user_predictions (id, user_id, prediction_type, subject_type, subject_id, prediction, metadata, locked_at, result)
      VALUES (${id}, ${userId}, ${input.predictionType}, ${input.subjectType}, ${input.subjectId}, ${tx.json(prediction)}, ${tx.json(metadata)}, ${input.lockedAt ? new Date(input.lockedAt) : null}, 'PENDING')
      ON CONFLICT (user_id, prediction_type, subject_type, subject_id) DO NOTHING
      RETURNING id, prediction_type AS "predictionType", subject_type AS "subjectType", subject_id AS "subjectId", prediction, metadata, submitted_at AS "submittedAt", locked_at AS "lockedAt", result, score`;
    if (!rows[0]) return null;
    const yardAward = await awardYardsInTransaction(tx, {
      userId,
      action: 'PREDICTION_SUBMITTED',
      sourceType: 'PREDICTION',
      sourceId: id,
    });
    return { ...rows[0], yardAward };
  });
}

export async function listPredictions(userId: string) {
  return authDb()<Array<Record<string, unknown>>>`
    SELECT id, prediction_type AS "predictionType", subject_type AS "subjectType", subject_id AS "subjectId", prediction, metadata, submitted_at AS "submittedAt", locked_at AS "lockedAt", resolved_at AS "resolvedAt", result, score
    FROM user_predictions WHERE user_id = ${userId} ORDER BY submitted_at DESC`;
}
