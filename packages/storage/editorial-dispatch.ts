import { MultiD1, type DatabaseOwner } from './multi-d1';
import { EditorialDirectory } from './editorial-directory';
import { D1Notifications } from './notifications';
/** Separate continuation. Intent is committed atomically with publication; inbox dedupe
 * survives a crash before the owner cursor acknowledges delivery. One recipient per call. */
export async function dispatchEditorial(router: MultiD1, owner: DatabaseOwner) {
  const s = router.storage(owner),
    users = router.users();
  const [intent] = await s.rows<any>(
    'SELECT * FROM app_editorial_dispatch WHERE done=0 ORDER BY id LIMIT 1',
  );
  if (!intent) return transferBriefing(router, owner);
  const value = JSON.parse(intent.payload);
  if (!intent.cursor) {
    await new EditorialDirectory(router).remember('story', intent.story_id, owner);
    await new EditorialDirectory(router).remember('public', intent.story_id, owner);
  }
  if (!intent.cursor) {
    if (value.state === 'REVIEW_REQUIRED')
      await router
        .shared()
        .statement(
          'INSERT INTO app_editorial_review_index(id,owner,team_id,version,headline,summary,status,confidence_score,importance_score,sources_json,reason,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,team_id=excluded.team_id,version=excluded.version,headline=excluded.headline,summary=excluded.summary,status=excluded.status,confidence_score=excluded.confidence_score,importance_score=excluded.importance_score,sources_json=excluded.sources_json,reason=excluded.reason,updated_at=excluded.updated_at WHERE version<=excluded.version',
          [
            intent.story_id,
            owner,
            value.team,
            intent.version,
            value.title,
            value.body,
            value.status,
            value.confidence,
            value.importance,
            JSON.stringify(value.sources),
            value.reason,
            value.updatedAt,
          ],
        )
        .run();
    else
      await router
        .shared()
        .statement('DELETE FROM app_editorial_review_index WHERE id=? AND version<=?', [
          intent.story_id,
          intent.version,
        ])
        .run();
  }
  if (!value.notify) {
    await s.statement('DELETE FROM app_editorial_dispatch WHERE id=?', [intent.id]).run();
    return { done: false };
  }
  const [recipient] = await users.rows<{ id: string }>(
    "SELECT u.id FROM app_users u JOIN app_settings p ON p.user_id=u.id WHERE u.status='ACTIVE' AND u.id>? AND json_extract(p.preferences_json,'$.preferredTeamId')=? AND NOT EXISTS(SELECT 1 FROM app_notification_preferences np WHERE np.user_id=u.id AND np.category IN('BREAKING_NEWS','BREAKING','HOT_READ') AND np.channel='IN_APP' AND np.enabled=0) ORDER BY u.id LIMIT 1",
    [intent.cursor, value.team],
  );
  if (recipient)
    await new D1Notifications(users).createNotification(recipient.id, {
      eventId: intent.id,
      dedupeKey: intent.id,
      teamAbbr: value.team,
      title: value.title,
      body: value.body,
      deepLink: `/the-beat?team=${value.team}&story=${intent.story_id}`,
      contentId: intent.story_id,
      contentType: 'BEAT_STORY',
      type: value.breaking ? 'BREAKING' : 'HOT_READ',
      category: value.breaking ? 'BREAKING' : 'HOT_READ',
      priority: value.breaking || value.importance >= 85 ? 'HIGH' : 'NORMAL',
      pushEligible: Boolean(value.breaking || value.importance >= 85),
      metadata: { storyVersion: intent.version, reason: value.reason },
    });
  if (recipient)
    await s
      .statement('UPDATE app_editorial_dispatch SET cursor=? WHERE id=? AND cursor=?', [
        recipient.id,
        intent.id,
        intent.cursor,
      ])
      .run();
  else
    await s
      .statement('DELETE FROM app_editorial_dispatch WHERE id=? AND cursor=?', [
        intent.id,
        intent.cursor,
      ])
      .run();
  return { done: false };
}

/** Copy the exact approved public briefing template into the central private mail queue.
 * No provider is called. Mark the team outbox done only after destination verification. */
async function transferBriefing(router: MultiD1, owner: DatabaseOwner) {
  const source = router.storage(owner),
    [job] = await source.rows<any>(
      "SELECT id,object_hash FROM app_briefing_mail_jobs WHERE status='READY' ORDER BY id LIMIT 1",
    );
  if (!job) return { done: true };
  const value = await source.get<any>(job.object_hash);
  if (value.approved !== true || value.id !== job.id) throw Error('Unapproved briefing template');
  const users = router.users(),
    hash = await users.put(value);
  if (hash !== job.object_hash) throw Error('Briefing copy digest mismatch');
  await users
    .statement(
      "INSERT INTO app_briefing_mail_jobs(id,object_hash,status) VALUES(?,?,'READY') ON CONFLICT(id) DO NOTHING",
      [job.id, hash],
    )
    .run();
  const [verified] = await users.rows<any>(
    'SELECT object_hash FROM app_briefing_mail_jobs WHERE id=?',
    [job.id],
  );
  if (verified?.object_hash !== hash) throw Error('Briefing queue identity conflict');
  await source
    .statement(
      "UPDATE app_briefing_mail_jobs SET status='DONE' WHERE id=? AND object_hash=? AND status='READY'",
      [job.id, hash],
    )
    .run();
  return { done: false };
}
