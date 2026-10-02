import { validateMessage } from '../../../packages/huddle/message';
import { randomUUID } from 'node:crypto';
import { authDb } from '@/server/auth/database';
import type { Message, Poll } from '../../../packages/huddle';
const cache = new Map<
  string,
  {
    until: number;
    pending: Promise<{ messages: Message[]; latest: Message[]; polls: Poll[]; cursor: string }>;
  }
>();
export async function publicSnapshot(room: string) {
  const old = cache.get(room);
  if (old && old.until > Date.now()) return old.pending;
  if (cache.size > 200)
    for (const [key, item] of cache) if (item.until < Date.now()) cache.delete(key);
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  const pending = (async () => {
    const sql = authDb();
    const cursor = new Date().toISOString();
    const messages = await sql<
      Message[]
    >`SELECT m.id,m.user_id AS "userId",coalesce(u.display_name,'Football Fan') AS name,u.avatar_url AS avatar,CASE WHEN m.removed THEN '' ELSE m.body END AS body,to_char(m.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,m.updated_at::text AS updated,m.play_id AS "playId",CASE WHEN m.removed THEN NULL ELSE m.media END AS media,m.reply_to AS "replyTo",m.removed,(SELECT count(*)::int FROM huddle_reactions r WHERE r.message_id=m.id) AS likes FROM huddle_messages m JOIN users u ON u.id=m.user_id WHERE m.room=${room} ORDER BY m.updated_at DESC,m.id DESC LIMIT 100`;
    const polls = await sql<
      Poll[]
    >`SELECT p.id,p.question,p.options,p.closes_at<=now() AS closed,ARRAY(SELECT count(v.user_id)::int FROM generate_series(0,jsonb_array_length(p.options)-1) n LEFT JOIN huddle_poll_votes v ON v.poll_id=p.id AND v.choice=n GROUP BY n ORDER BY n) AS counts FROM huddle_polls p WHERE room=${room} ORDER BY created_at DESC LIMIT 10`;
    return {
      latest: await history(room, `${cursor}|ffffffff-ffff-ffff-ffff-ffffffffffff`),
      messages: messages.map((m) => ({
        ...m,
        at: m.at,
        updated: new Date((m as Message & { updated: string }).updated).toISOString(),
      })),
      polls,
      cursor,
    };
  })();
  cache.set(room, { until: Date.now() + 15000, pending });
  try {
    return await pending;
  } catch (e) {
    cache.delete(room);
    throw e;
  }
}
export async function history(room: string, before: string) {
  const [time, id] = before.split('|');
  return authDb()<
    Message[]
  >`SELECT m.id,m.user_id AS "userId",coalesce(u.display_name,'Football Fan') AS name,u.avatar_url AS avatar,m.body,to_char(m.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,m.updated_at::text AS updated,m.play_id AS "playId",CASE WHEN m.removed THEN NULL ELSE m.media END AS media,m.reply_to AS "replyTo",m.removed,(SELECT count(*)::int FROM huddle_reactions r WHERE r.message_id=m.id) AS likes FROM huddle_messages m JOIN users u ON u.id=m.user_id WHERE m.room=${room} AND (m.created_at,m.id)<(${time},${id}::uuid) AND NOT m.removed ORDER BY m.created_at DESC,m.id DESC LIMIT 50`;
}
export async function viewer(user: string, room: string) {
  const sql = authDb();
  const [hidden, liked, votes] = await Promise.all([
    sql<
      { id: string }[]
    >`SELECT target_id AS id FROM huddle_user_filters WHERE user_id=${user} UNION SELECT user_id AS id FROM huddle_user_filters WHERE target_id=${user} AND kind='block'`,
    sql<
      { id: string }[]
    >`SELECT r.message_id AS id FROM huddle_reactions r JOIN huddle_messages m ON m.id=r.message_id WHERE r.user_id=${user} AND m.room=${room} ORDER BY m.created_at DESC LIMIT 250`,
    sql<
      { id: string; choice: number }[]
    >`SELECT v.poll_id AS id,v.choice FROM huddle_poll_votes v JOIN huddle_polls p ON p.id=v.poll_id WHERE v.user_id=${user} AND p.room=${room} ORDER BY p.created_at DESC LIMIT 10`,
  ]);
  return {
    hiddenUsers: hidden.map((x) => x.id),
    liked: liked.map((x) => x.id),
    voted: Object.fromEntries(votes.map((x) => [x.id, x.choice])),
  };
}
export async function action(
  user: string,
  room: string,
  b: any,
  admin: boolean,
  playId: string | null,
) {
  const message = b.action === 'message' ? validateMessage(b) : undefined;
  const sql = authDb();
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`huddle:${user}`},0))`;
    const banned =
      await tx`SELECT 1 FROM huddle_enforcement WHERE user_id=${user} AND until_at>now()`;
    if (banned.length) throw Error('Community participation is temporarily restricted.');
    if (b.action === 'message') {
      b = { ...b, ...message };
      if (b.replyTo) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.replyTo))
          throw Error('Invalid reply.');
        const parent =
          await tx`SELECT 1 FROM huddle_messages WHERE id=${b.replyTo}::uuid AND room=${room} AND NOT removed`;
        if (!parent.length) throw Error('Reply unavailable.');
      }
      const recent =
        await tx`SELECT 1 FROM huddle_messages WHERE user_id=${user} AND created_at>now()-interval '1 minute' LIMIT 6`;
      if (recent.length >= 6) throw Error('Please wait before sending another message.');
      if (/(?:https?:\/\/.*){3}|(.)\1{15}|\b(fuck|shit|cunt)\b/i.test(b.body))
        throw Error('Please revise your message before posting.');
      const duplicate =
        await tx`SELECT 1 FROM huddle_messages WHERE user_id=${user} AND body=${b.body} AND media IS NOT DISTINCT FROM ${b.media ? tx.json(b.media) : null}::jsonb AND created_at>now()-interval '5 minutes'`;
      if (duplicate.length) throw Error('You already sent that message.');
      await tx`INSERT INTO huddle_messages(id,room,user_id,body,play_id,client_id,media,reply_to)VALUES(${randomUUID()},${room},${user},${b.body},${playId},${b.clientId},${b.media ? tx.json(b.media) : null},${b.replyTo ?? null}) ON CONFLICT(user_id,client_id) DO NOTHING`;
    } else if (b.action === 'like') {
      const messages =
        await tx`SELECT id FROM huddle_messages WHERE id=${b.id} AND room=${room} AND NOT removed`;
      if (!messages.length) throw Error('Message unavailable.');
      if (b.enabled)
        await tx`INSERT INTO huddle_reactions(message_id,user_id)VALUES(${b.id},${user}) ON CONFLICT DO NOTHING`;
      else await tx`DELETE FROM huddle_reactions WHERE message_id=${b.id} AND user_id=${user}`;
      await tx`UPDATE huddle_messages SET updated_at=now() WHERE id=${b.id}`;
    } else if (b.action === 'vote') {
      const polls =
        await tx`SELECT id FROM huddle_polls WHERE id=${b.id} AND room=${room} AND closes_at>now() AND jsonb_array_length(options)>${b.choice} FOR SHARE`;
      if (!polls.length) throw Error('Poll is closed or unavailable.');
      await tx`INSERT INTO huddle_poll_votes(poll_id,user_id,choice)VALUES(${b.id},${user},${b.choice}) ON CONFLICT(poll_id,user_id) DO NOTHING`;
    } else if (b.action === 'report') {
      await tx`INSERT INTO huddle_reports(message_id,user_id,reason) SELECT id,${user},${b.reason} FROM huddle_messages WHERE id=${b.id} AND room=${room} ON CONFLICT(message_id,user_id) DO UPDATE SET reason=EXCLUDED.reason`;
    } else if (b.action === 'mute' || b.action === 'block') {
      await tx`INSERT INTO huddle_user_filters(user_id,target_id,kind)VALUES(${user},${b.userId},${b.action}) ON CONFLICT(user_id,target_id) DO UPDATE SET kind=EXCLUDED.kind`;
    } else if (b.action === 'unhide')
      await tx`DELETE FROM huddle_user_filters WHERE user_id=${user} AND target_id=${b.userId}`;
    else {
      if (!admin) throw Error('Moderator access required.');
      if (b.action === 'remove')
        await tx`UPDATE huddle_messages SET removed=true,updated_at=now() WHERE id=${b.id} AND room=${room}`;
      if (b.action === 'suspend')
        await tx`INSERT INTO huddle_enforcement(user_id,until_at,reason,moderator_id)VALUES(${b.userId},now()+interval '24 hours',${b.reason},${user}) ON CONFLICT(user_id) DO UPDATE SET until_at=EXCLUDED.until_at,reason=EXCLUDED.reason,moderator_id=EXCLUDED.moderator_id`;
      if (b.action === 'poll')
        await tx`INSERT INTO huddle_polls(id,room,question,options,closes_at)VALUES(${randomUUID()},${room},${b.question},${tx.json(b.options)},now()+interval '1 hour')`;
    }
  });
  cache.delete(room);
}

export async function moderationQueue(room: string) {
  return authDb()`SELECT m.id,m.user_id AS "userId",m.body,m.media,m.removed,coalesce(u.display_name,'Football Fan') AS name,count(r.user_id)::int AS reports FROM huddle_reports r JOIN huddle_messages m ON m.id=r.message_id JOIN users u ON u.id=m.user_id WHERE m.room=${room} AND NOT m.removed GROUP BY m.id,u.display_name ORDER BY max(r.created_at) DESC LIMIT 50`;
}
