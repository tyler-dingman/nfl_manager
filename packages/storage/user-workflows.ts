import { D1UserRepository } from './user';
import { D1Rewards } from './rewards';
import { guardedBatch } from './atomic';
import { isNewVisit } from '../../src/features/catch-up/engine';
import { secureToken, tokenHash } from '../../src/server/auth/crypto';
import type * as PG from '../../src/server/user/content-repository-postgres';
const date = (n: number | null) => (n == null ? null : new Date(n));
export class D1UserWorkflows extends D1UserRepository {
  async requestEmailChange(user: string, email: string) {
    const token = secureToken(),
      now = Date.now();
    await this.s.batch([
      this.s.statement(
        'UPDATE app_email_change_requests SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL',
        [now, user],
      ),
      this.s.statement(
        'INSERT INTO app_email_change_requests(id,user_id,new_email,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?)',
        [crypto.randomUUID(), user, email.toLowerCase(), tokenHash(token), now + 1800000, now],
      ),
    ]);
    return token;
  }
  async confirmEmailChange(token: string) {
    const now = Date.now(),
      [r] = await this.s.rows<any>('SELECT * FROM app_email_change_requests WHERE token_hash=?', [
        tokenHash(token),
      ]);
    if (!r) throw Error('This email-change link is invalid or expired.');
    await guardedBatch(
      this.s,
      [
        {
          sql: 'EXISTS(SELECT 1 FROM app_email_change_requests WHERE id=? AND consumed_at IS NULL AND expires_at>?)',
          values: [r.id, now],
        },
      ],
      [
        this.s.statement('UPDATE app_email_change_requests SET consumed_at=? WHERE id=?', [
          now,
          r.id,
        ]),
        this.s.statement(
          'UPDATE app_users SET primary_email=?,email_verified=1,updated_at=? WHERE id=?',
          [r.new_email, now, r.user_id],
        ),
      ],
      'This email-change link is invalid or expired.',
    );
    return r.user_id as string;
  }
  async listContentState(user: string, ids?: string[]) {
    return (
      await this.s.rows<any>(
        'SELECT content_type AS contentType,content_id AS contentId,media_version AS mediaVersion,first_viewed_at AS firstViewedAt,last_viewed_at AS lastViewedAt,completed_at AS completedAt,progress_seconds AS progressSeconds,duration_seconds AS durationSeconds,updated_at AS updatedAt FROM app_user_content_state WHERE user_id=? AND(? IS NULL OR content_id IN(SELECT value FROM json_each(?))) ORDER BY updated_at DESC',
        [user, ids?.length ? 1 : null, JSON.stringify(ids ?? [])],
      )
    ).map((r) => ({
      ...r,
      firstViewedAt: date(r.firstViewedAt),
      lastViewedAt: date(r.lastViewedAt),
      completedAt: date(r.completedAt),
      updatedAt: date(r.updatedAt),
    }));
  }
  async upsertContentState(user: string, input: PG.ContentStateInput) {
    const now = Date.now(),
      viewed = input.viewed || input.completed ? now : null;
    return await this.s
      .statement(
        'INSERT INTO app_user_content_state(id,user_id,content_type,content_id,media_version,first_viewed_at,last_viewed_at,completed_at,progress_seconds,duration_seconds,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,content_type,content_id) DO UPDATE SET media_version=coalesce(excluded.media_version,media_version),first_viewed_at=coalesce(first_viewed_at,excluded.first_viewed_at),last_viewed_at=coalesce(excluded.last_viewed_at,last_viewed_at),completed_at=coalesce(excluded.completed_at,completed_at),progress_seconds=coalesce(excluded.progress_seconds,progress_seconds),duration_seconds=coalesce(excluded.duration_seconds,duration_seconds),updated_at=excluded.updated_at RETURNING id',
        [
          crypto.randomUUID(),
          user,
          input.contentType,
          input.contentId,
          input.mediaVersion ?? null,
          viewed,
          viewed,
          input.completed ? now : null,
          input.progressSeconds ?? null,
          input.durationSeconds ?? null,
          now,
        ],
      )
      .first<{ id: string }>();
  }
  async visit(user: string, team: string) {
    const [r] = await this.s.rows<any>(
      'SELECT * FROM app_user_team_visit_state WHERE user_id=? AND team_id=?',
      [user, team],
    );
    return r
      ? {
          teamId: r.team_id,
          firstSeenAt: date(r.first_seen_at)!,
          lastVisitedAt: date(r.last_visited_at)!,
          currentVisitStartedAt: date(r.current_visit_started_at)!,
          visitCount: r.visit_count as number,
          lastCaughtUpAt: date(r.last_caught_up_at),
          lastCaughtUpSnapshotId: r.last_caught_up_snapshot_id as string | null,
          caughtUpStoryState: JSON.parse(r.caught_up_story_state),
          lastSeenSnapshotId: r.last_seen_snapshot_id as string | null,
          updatedAt: date(r.updated_at),
          version: r.version as number,
        }
      : null;
  }
  getTeamVisitState(user: string, team: string) {
    return this.visit(user, team);
  }
  async updateTeamVisitState(user: string, team: string, snapshot: string) {
    const now = Date.now();
    await this.s
      .statement(
        'INSERT INTO app_user_team_visit_state(user_id,team_id,last_visited_at,last_seen_snapshot_id,updated_at,first_seen_at,current_visit_started_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,team_id) DO UPDATE SET last_visited_at=excluded.last_visited_at,last_seen_snapshot_id=excluded.last_seen_snapshot_id,updated_at=excluded.updated_at,version=version+1',
        [user, team, now, snapshot, now, now, now],
      )
      .run();
    return this.visit(user, team);
  }
  async recordCatchUpVisit(input: Parameters<typeof PG.recordCatchUpVisit>[0]) {
    const now = (input.now ?? new Date()).getTime();
    for (let attempt = 0; attempt < 5; attempt++) {
      const old = await this.visit(input.userId, input.teamId),
        first = !old || !old.caughtUpStoryState?.length,
        newVisit = first || isNewVisit(old!.lastVisitedAt, new Date(now));
      try {
        await guardedBatch(
          this.s,
          [
            old
              ? {
                  sql: 'EXISTS(SELECT 1 FROM app_user_team_visit_state WHERE user_id=? AND team_id=? AND version=?)',
                  values: [input.userId, input.teamId, old.version],
                }
              : {
                  sql: 'NOT EXISTS(SELECT 1 FROM app_user_team_visit_state WHERE user_id=? AND team_id=?)',
                  values: [input.userId, input.teamId],
                },
          ],
          [
            this.s.statement(
              'INSERT INTO app_user_team_visit_state(user_id,team_id,last_visited_at,last_seen_snapshot_id,updated_at,first_seen_at,current_visit_started_at,visit_count,last_caught_up_at,last_caught_up_snapshot_id,caught_up_story_state) VALUES(?,?,?,?,?,?,?,1,?,?,?) ON CONFLICT(user_id,team_id) DO UPDATE SET last_visited_at=excluded.last_visited_at,last_seen_snapshot_id=excluded.last_seen_snapshot_id,updated_at=excluded.updated_at,current_visit_started_at=CASE WHEN ? THEN excluded.current_visit_started_at ELSE current_visit_started_at END,visit_count=CASE WHEN ? THEN 1 ELSE visit_count+? END,last_caught_up_at=CASE WHEN ? THEN excluded.last_caught_up_at ELSE last_caught_up_at END,last_caught_up_snapshot_id=CASE WHEN ? THEN excluded.last_caught_up_snapshot_id ELSE last_caught_up_snapshot_id END,caught_up_story_state=CASE WHEN ? THEN excluded.caught_up_story_state ELSE caught_up_story_state END,version=version+1',
              [
                input.userId,
                input.teamId,
                now,
                input.snapshotId,
                now,
                old?.firstSeenAt.getTime() ?? now,
                now,
                now,
                input.snapshotId,
                JSON.stringify(input.storyState),
                newVisit ? 1 : 0,
                first ? 1 : 0,
                newVisit ? 1 : 0,
                first ? 1 : 0,
                first ? 1 : 0,
                first ? 1 : 0,
              ],
            ),
          ],
        );
        return {
          state: (await this.visit(input.userId, input.teamId))!,
          firstVisit: first,
          newVisit,
        };
      } catch (error) {
        if (attempt === 4 || !/State changed|UNIQUE constraint/.test(String(error))) throw error;
      }
    }
    throw Error('Visit conflict');
  }
  async completeCatchUp(input: Parameters<typeof PG.completeCatchUp>[0]) {
    const now = (input.now ?? new Date()).getTime();
    await this.s
      .statement(
        'UPDATE app_user_team_visit_state SET last_caught_up_at=?,last_caught_up_snapshot_id=?,caught_up_story_state=?,updated_at=?,version=version+1 WHERE user_id=? AND team_id=?',
        [now, input.snapshotId, JSON.stringify(input.storyState), now, input.userId, input.teamId],
      )
      .run();
    return this.visit(input.userId, input.teamId);
  }
  async getPollVote(user: string, question: string) {
    return await this.s
      .statement(
        'SELECT option_id AS optionId FROM app_user_poll_votes WHERE user_id=? AND question_id=?',
        [user, question],
      )
      .first<{ optionId: string }>();
  }
  async savePollVote(user: string, question: string, option: string) {
    await this.s
      .statement(
        'INSERT INTO app_user_poll_votes(id,user_id,question_id,option_id,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,question_id) DO NOTHING',
        [crypto.randomUUID(), user, question, option, Date.now()],
      )
      .run();
    return this.getPollVote(user, question);
  }
  async createPrediction(user: string, input: Parameters<typeof PG.createPrediction>[1]) {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (
        (
          await this.s.rows(
            'SELECT 1 FROM app_user_predictions WHERE user_id=? AND prediction_type=? AND subject_type=? AND subject_id=?',
            [user, input.predictionType, input.subjectType, input.subjectId],
          )
        ).length
      )
        return null;
      const id = crypto.randomUUID(),
        now = Date.now(),
        hash = await this.s.put({
          schema: 1,
          id,
          owner: user,
          prediction: input.prediction,
          metadata: input.metadata ?? {},
        }),
        reward = await new D1Rewards(this.s).plan({
          userId: user,
          action: 'PREDICTION_SUBMITTED',
          sourceType: 'PREDICTION',
          sourceId: id,
        });
      try {
        await guardedBatch(
          this.s,
          [
            {
              sql: 'NOT EXISTS(SELECT 1 FROM app_user_predictions WHERE user_id=? AND prediction_type=? AND subject_type=? AND subject_id=?)',
              values: [user, input.predictionType, input.subjectType, input.subjectId],
            },
          ],
          [
            this.s.statement(
              "INSERT INTO app_user_predictions(id,user_id,prediction_type,subject_type,subject_id,object_hash,submitted_at,locked_at,result) VALUES(?,?,?,?,?,?,?,?,'PENDING')",
              [
                id,
                user,
                input.predictionType,
                input.subjectType,
                input.subjectId,
                hash,
                now,
                input.lockedAt ? Date.parse(input.lockedAt) : null,
              ],
            ),
            ...reward.statements,
          ],
        );
        const row = (await this.listPredictions(user)).find((p) => p.id === id)!;
        return { ...row, yardAward: reward.result };
      } catch (error) {
        if (
          attempt === 3 ||
          !/State changed|CHECK constraint|UNIQUE constraint/.test(String(error))
        )
          throw error;
      }
    }
    throw Error('Prediction conflict');
  }
  async listPredictions(user: string) {
    const rows = await this.s.rows<any>(
      'SELECT * FROM app_user_predictions WHERE user_id=? ORDER BY submitted_at DESC',
      [user],
    );
    return Promise.all(
      rows.map(async (r) => {
        const p = await this.s.get<any>(r.object_hash);
        if (p.schema !== 1 || p.id !== r.id || p.owner !== user)
          throw Error('Prediction ownership mismatch');
        return {
          id: r.id as string,
          predictionType: r.prediction_type as string,
          subjectType: r.subject_type as string,
          subjectId: r.subject_id as string,
          prediction: p.prediction,
          metadata: p.metadata,
          submittedAt: date(r.submitted_at),
          lockedAt: date(r.locked_at),
          resolvedAt: date(r.resolved_at),
          result: r.result as string,
          score: r.score as number | null,
        };
      }),
    );
  }
}
