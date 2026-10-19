import { Storage } from './core';
import { guardedBatch, iso } from './atomic';
import { validateMessage } from '../huddle/message';
import type { Message, Poll } from '../huddle';
const messageSelect = `SELECT m.id,m.user_id AS userId,coalesce(u.display_name,'Football Fan') AS name,u.avatar_url AS avatar,CASE WHEN m.removed THEN '' ELSE m.body END AS body,m.created_at AS at,m.updated_at AS updated,m.play_id AS playId,CASE WHEN m.removed THEN NULL ELSE m.media END AS media,m.reply_to AS replyTo,m.removed,(SELECT count(*) FROM app_huddle_reactions r WHERE r.message_id=m.id) AS likes FROM app_huddle_messages m JOIN app_users u ON u.id=m.user_id`;
const shape = (m: any): Message => ({
  ...m,
  at: iso(m.at)!,
  updated: iso(m.updated),
  removed: Boolean(m.removed),
  ...(m.media ? { media: JSON.parse(m.media) } : { media: undefined }),
});
export class D1Huddle {
  constructor(readonly s: Storage) {}
  async publicSnapshot(room: string) {
    const cursor = new Date().toISOString();
    const [messages, polls, votes, latest] = await Promise.all([
      this.s.rows<any>(
        messageSelect + ' WHERE m.room=? ORDER BY m.updated_at DESC,m.id DESC LIMIT 100',
        [room],
      ),
      this.s.rows<any>(
        'SELECT id,question,options,closes_at FROM app_huddle_polls WHERE room=? ORDER BY created_at DESC,id DESC LIMIT 10',
        [room],
      ),
      this.s.rows<any>(
        'SELECT v.poll_id,v.choice,count(*) AS count FROM app_huddle_poll_votes v JOIN app_huddle_polls p ON p.id=v.poll_id WHERE p.room=? GROUP BY v.poll_id,v.choice',
        [room],
      ),
      this.history(room, cursor + '|ffffffff-ffff-ffff-ffff-ffffffffffff'),
    ]);
    return {
      messages: messages.map(shape),
      latest,
      polls: polls.map((p): Poll => {
        const options = JSON.parse(p.options);
        return {
          id: p.id,
          question: p.question,
          options,
          closed: p.closes_at <= Date.now(),
          counts: options.map(
            (_: string, i: number) =>
              votes.find((v) => v.poll_id === p.id && v.choice === i)?.count ?? 0,
          ),
        };
      }),
      cursor,
    };
  }
  async history(room: string, before: string) {
    const [time, id] = before.split('|'),
      at = Date.parse(time);
    if (!Number.isFinite(at) || !id) throw Error('Invalid history cursor');
    return (
      await this.s.rows<any>(
        messageSelect +
          ' WHERE m.room=? AND (m.created_at,m.id)<(?,?) AND m.removed=0 ORDER BY m.created_at DESC,m.id DESC LIMIT 50',
        [room, at, id],
      )
    ).map(shape);
  }
  async viewer(user: string, room: string) {
    const [hidden, liked, votes] = await Promise.all([
      this.s.rows<any>(
        "SELECT target_id AS id FROM app_huddle_user_filters WHERE user_id=? UNION SELECT user_id AS id FROM app_huddle_user_filters WHERE target_id=? AND kind='block'",
        [user, user],
      ),
      this.s.rows<any>(
        'SELECT r.message_id AS id FROM app_huddle_reactions r JOIN app_huddle_messages m ON m.id=r.message_id WHERE r.user_id=? AND m.room=? ORDER BY m.created_at DESC LIMIT 250',
        [user, room],
      ),
      this.s.rows<any>(
        'SELECT v.poll_id AS id,v.choice FROM app_huddle_poll_votes v JOIN app_huddle_polls p ON p.id=v.poll_id WHERE v.user_id=? AND p.room=? ORDER BY p.created_at DESC LIMIT 10',
        [user, room],
      ),
    ]);
    return {
      hiddenUsers: hidden.map((r) => r.id),
      liked: liked.map((r) => r.id),
      voted: Object.fromEntries(votes.map((r) => [r.id, r.choice])),
    };
  }
  async action(user: string, room: string, b: any, admin: boolean, playId: string | null) {
    const now = Date.now(),
      guards = [
        {
          sql: 'NOT EXISTS(SELECT 1 FROM app_huddle_enforcement WHERE user_id=? AND until_at>?)',
          values: [user, now] as unknown[],
        },
      ],
      writes = [];
    if (b.action === 'message') {
      const m = validateMessage(b),
        media = m.media ? JSON.stringify(m.media) : null;
      if (/(?:https?:\/\/.*){3}|(.)\1{15}|\b(fuck|shit|cunt)\b/i.test(m.body))
        throw Error('Please revise your message before posting.');
      if (m.replyTo)
        guards.push({
          sql: 'EXISTS(SELECT 1 FROM app_huddle_messages WHERE id=? AND room=? AND removed=0)',
          values: [m.replyTo, room],
        });
      guards.push(
        {
          sql: '(SELECT count(*) FROM app_huddle_messages WHERE user_id=? AND created_at>?)<6',
          values: [user, now - 60000],
        },
        {
          sql: 'NOT EXISTS(SELECT 1 FROM app_huddle_messages WHERE user_id=? AND body=? AND media IS ? AND created_at>?)',
          values: [user, m.body, media, now - 300000],
        },
      );
      writes.push(
        this.s.statement(
          'INSERT INTO app_huddle_messages(id,room,user_id,body,play_id,client_id,media,reply_to,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,client_id) DO NOTHING',
          [
            crypto.randomUUID(),
            room,
            user,
            m.body,
            playId,
            b.clientId,
            media,
            m.replyTo ?? null,
            now,
            now,
          ],
        ),
      );
    } else if (b.action === 'like') {
      guards.push({
        sql: 'EXISTS(SELECT 1 FROM app_huddle_messages WHERE id=? AND room=? AND removed=0)',
        values: [b.id, room],
      });
      writes.push(
        b.enabled
          ? this.s.statement(
              'INSERT INTO app_huddle_reactions(message_id,user_id) VALUES(?,?) ON CONFLICT DO NOTHING',
              [b.id, user],
            )
          : this.s.statement('DELETE FROM app_huddle_reactions WHERE message_id=? AND user_id=?', [
              b.id,
              user,
            ]),
        this.s.statement('UPDATE app_huddle_messages SET updated_at=? WHERE id=?', [now, b.id]),
      );
    } else if (b.action === 'vote') {
      guards.push({
        sql: 'EXISTS(SELECT 1 FROM app_huddle_polls WHERE id=? AND room=? AND closes_at>? AND ?>=0 AND ?<json_array_length(options))',
        values: [b.id, room, now, b.choice, b.choice],
      });
      writes.push(
        this.s.statement(
          'INSERT INTO app_huddle_poll_votes(poll_id,user_id,choice) VALUES(?,?,?) ON CONFLICT DO NOTHING',
          [b.id, user, b.choice],
        ),
      );
    } else if (b.action === 'report')
      writes.push(
        this.s.statement(
          'INSERT INTO app_huddle_reports(message_id,user_id,reason,created_at) SELECT id,?,?,? FROM app_huddle_messages WHERE id=? AND room=? ON CONFLICT(message_id,user_id) DO UPDATE SET reason=excluded.reason',
          [user, b.reason, now, b.id, room],
        ),
      );
    else if (b.action === 'mute' || b.action === 'block')
      writes.push(
        this.s.statement(
          'INSERT INTO app_huddle_user_filters(user_id,target_id,kind) VALUES(?,?,?) ON CONFLICT(user_id,target_id) DO UPDATE SET kind=excluded.kind',
          [user, b.userId, b.action],
        ),
      );
    else if (b.action === 'unhide')
      writes.push(
        this.s.statement('DELETE FROM app_huddle_user_filters WHERE user_id=? AND target_id=?', [
          user,
          b.userId,
        ]),
      );
    else {
      if (!admin) throw Error('Moderator access required.');
      if (b.action === 'remove')
        writes.push(
          this.s.statement(
            'UPDATE app_huddle_messages SET removed=1,updated_at=? WHERE id=? AND room=?',
            [now, b.id, room],
          ),
        );
      else if (b.action === 'suspend')
        writes.push(
          this.s.statement(
            'INSERT INTO app_huddle_enforcement(user_id,until_at,reason,moderator_id) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET until_at=excluded.until_at,reason=excluded.reason,moderator_id=excluded.moderator_id',
            [b.userId, now + 86400000, b.reason, user],
          ),
        );
      else if (b.action === 'poll')
        writes.push(
          this.s.statement(
            'INSERT INTO app_huddle_polls(id,room,question,options,closes_at,created_at) VALUES(?,?,?,?,?,?)',
            [crypto.randomUUID(), room, b.question, JSON.stringify(b.options), now + 3600000, now],
          ),
        );
      else throw Error('Unknown community action');
    }
    await guardedBatch(
      this.s,
      guards,
      writes,
      'Community action is unavailable, restricted, duplicate or rate limited.',
    );
  }
  async moderationQueue(room: string) {
    return (
      await this.s.rows<any>(
        "SELECT m.id,m.user_id AS userId,m.body,m.media,m.removed,coalesce(u.display_name,'Football Fan') AS name,count(r.user_id) AS reports FROM app_huddle_reports r JOIN app_huddle_messages m ON m.id=r.message_id JOIN app_users u ON u.id=m.user_id WHERE m.room=? AND m.removed=0 GROUP BY m.id,u.display_name ORDER BY max(r.created_at) DESC LIMIT 50",
        [room],
      )
    ).map((r) => ({
      ...r,
      media: r.media ? JSON.parse(r.media) : null,
      removed: Boolean(r.removed),
    }));
  }
}
