import { Storage } from './core';
import { guardedBatch, iso } from './atomic';
import {
  socialNotification,
  socialNotificationBatch,
  drainSocialNotifications,
} from './social-outbox';
import { secureToken, tokenHash } from '../../src/server/auth/crypto';
import { applicationEnvironment } from '../../src/server/persistence/bindings';
import {
  canAcceptCrewInvite,
  CREW_DAILY_INVITE_LIMIT,
  normalizeCrewInviteRecipient,
} from '../../src/features/crew/policy';
import { resolveCrewShareAudience } from '../../src/features/crew/share-selection';
import { crewEmailProvider, crewSmsProvider } from '../../src/server/crew/delivery';
import type { crewPostSchema, crewUpdateSchema } from '../../src/features/crew/validation';
import type { z } from 'zod';
const memberGuard = (user: string, crew: string, owner = false) => ({
  sql: `EXISTS(SELECT 1 FROM app_crew_members WHERE user_id=? AND crew_id=? AND status='ACTIVE'${owner ? " AND role='OWNER'" : ''})`,
  values: [user, crew],
});
export class D1Crew {
  constructor(readonly s: Storage) {}
  async requireCrewMember(user: string) {
    const [row] = await this.s.rows<{ crewId: string; role: string }>(
      "SELECT crew_id AS crewId,role FROM app_crew_members WHERE user_id=? AND status='ACTIVE' LIMIT 1",
      [user],
    );
    if (!row) throw Error('Join a Crew first.');
    return row;
  }
  async getCrewForUser(user: string) {
    const [c] = await this.s.rows<any>(
      "SELECT c.*,m.role,u.display_name AS owner_name FROM app_crews c JOIN app_crew_members m ON m.crew_id=c.id JOIN app_users u ON u.id=c.owner_user_id WHERE m.user_id=? AND m.status='ACTIVE' LIMIT 1",
      [user],
    );
    if (!c) return null;
    const now = new Date(),
      week = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
    const [members, activity, invites, rank] = await Promise.all([
      this.s.rows<any>(
        "SELECT u.id,u.display_name AS displayName,u.avatar_url AS avatarUrl,m.role,m.joined_at AS joinedAt,coalesce((SELECT sum(e.yards) FROM app_reward_events e WHERE e.user_id=u.id AND e.created_at>=?),0) AS weeklyYards,coalesce(a.lifetime_yards,0) AS lifetimeYards FROM app_crew_members m JOIN app_users u ON u.id=m.user_id LEFT JOIN app_reward_accounts a ON a.user_id=u.id WHERE m.crew_id=? AND m.status='ACTIVE' ORDER BY weeklyYards DESC,u.display_name",
        [week.getTime(), c.id],
      ),
      this.s.rows<any>(
        'SELECT a.id,a.type,a.content_id AS contentId,a.content_type AS contentType,a.href,a.message,a.metadata,a.created_at AS createdAt,a.actor_user_id AS actorUserId,u.display_name AS actorName,u.avatar_url AS actorAvatar FROM app_crew_activity a LEFT JOIN app_users u ON u.id=a.actor_user_id WHERE a.crew_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT 30',
        [c.id],
      ),
      this.s.rows<any>(
        "SELECT id,channel,status,delivery_state AS deliveryState,recipient_hint AS recipientHint,created_at AS createdAt,expires_at AS expiresAt FROM app_crew_invites WHERE crew_id=? AND status='PENDING' ORDER BY created_at DESC,id",
        [c.id],
      ),
      this.s.rows<any>(
        "WITH totals AS(SELECT c.id,coalesce(sum(CASE WHEN e.created_at>=? THEN e.yards ELSE 0 END),0) AS yards FROM app_crews c LEFT JOIN app_crew_members m ON m.crew_id=c.id AND m.status='ACTIVE' LEFT JOIN app_reward_events e ON e.user_id=m.user_id GROUP BY c.id) SELECT position FROM(SELECT id,row_number() OVER(ORDER BY yards DESC,id) AS position FROM totals) WHERE id=?",
        [week.getTime(), c.id],
      ),
    ]);
    const ids = JSON.stringify(activity.map((a) => a.id));
    const [comments, reactions] = await Promise.all([
      this.s.rows<any>(
        'SELECT cc.id,cc.activity_id,cc.message,cc.created_at AS createdAt,u.display_name AS actorName,u.avatar_url AS actorAvatar FROM app_crew_comments cc JOIN app_users u ON u.id=cc.user_id WHERE cc.activity_id IN(SELECT value FROM json_each(?)) ORDER BY cc.created_at,cc.id',
        [ids],
      ),
      this.s.rows<any>(
        'SELECT activity_id,reaction,user_id AS userId FROM app_crew_reactions WHERE activity_id IN(SELECT value FROM json_each(?))',
        [ids],
      ),
    ]);
    return {
      id: c.id,
      name: c.name,
      teamAbbr: c.team_abbr,
      ownerUserId: c.owner_user_id,
      ownerName: c.owner_name,
      createdAt: new Date(c.created_at),
      photoUrl: c.photo_url,
      role: c.role,
      members: members.map((m) => ({
        ...m,
        joinedAt: m.joinedAt == null ? null : new Date(m.joinedAt),
      })),
      activity: activity.map((a) => ({
        ...a,
        metadata: JSON.parse(a.metadata),
        createdAt: new Date(a.createdAt),
        comments: comments
          .filter((v) => v.activity_id === a.id)
          .map(({ activity_id, ...v }) => ({ ...v, createdAt: new Date(v.createdAt) })),
        reactions: reactions
          .filter((v) => v.activity_id === a.id)
          .map(({ activity_id, ...v }) => v),
      })),
      pendingInvites: invites.map((i) => ({
        ...i,
        createdAt: new Date(i.createdAt),
        expiresAt: new Date(i.expiresAt),
      })),
      weeklyYards: members.reduce((n, m) => n + Number(m.weeklyYards), 0),
      rank: rank[0]?.position ?? 1,
    };
  }
  async createCrew(user: string, input: { name: string; teamAbbr: string }) {
    const id = crypto.randomUUID(),
      now = Date.now();
    await guardedBatch(
      this.s,
      [
        {
          sql: "NOT EXISTS(SELECT 1 FROM app_crew_members WHERE user_id=? AND status='ACTIVE')",
          values: [user],
        },
      ],
      [
        this.s.statement(
          'INSERT INTO app_crews(id,name,team_abbr,owner_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?)',
          [id, input.name, input.teamAbbr, user, now, now],
        ),
        this.s.statement(
          "INSERT INTO app_crew_members(id,crew_id,user_id,role,status,joined_at,created_at,updated_at) VALUES(?,?,?,'OWNER','ACTIVE',?,?,?)",
          [crypto.randomUUID(), id, user, now, now, now],
        ),
        this.s.statement(
          "INSERT INTO app_crew_activity(id,crew_id,actor_user_id,type,metadata,created_at) VALUES(?,?,?,'CREW_CREATED','{}',?)",
          [crypto.randomUUID(), id, user, now],
        ),
      ],
      'You already belong to a Crew.',
    );
    return { id };
  }
  async createCrewInvite(
    user: string,
    input: {
      channel: 'IN_APP' | 'SMS' | 'EMAIL' | 'SHARE_LINK';
      recipient?: string;
      inviteeUserId?: string;
    },
  ) {
    const m = await this.requireCrewMember(user),
      [crew] = await this.s.rows<any>(
        'SELECT c.name,u.display_name AS inviter_name FROM app_crews c JOIN app_users u ON u.id=? WHERE c.id=?',
        [user, m.crewId],
      );
    let invitee = input.inviteeUserId ?? null;
    if (!invitee && input.channel === 'EMAIL' && input.recipient) {
      const [u] = await this.s.rows<any>(
        'SELECT id FROM app_users WHERE lower(primary_email)=lower(?) LIMIT 1',
        [input.recipient],
      );
      invitee = u?.id ?? null;
    }
    const normalized =
        input.recipient && (input.channel === 'EMAIL' || input.channel === 'SMS')
          ? normalizeCrewInviteRecipient(input.channel, input.recipient)
          : null,
      recipientHash = normalized ? tokenHash(normalized.trim().toLowerCase()) : null,
      hint = normalized
        ? normalized.includes('@')
          ? normalized.replace(/^(.{1,2}).*(@.*)$/, '$1•••$2')
          : `•••${normalized.replace(/\D/g, '').slice(-4)}`
        : null,
      token = secureToken(),
      id = crypto.randomUUID(),
      now = Date.now(),
      base = applicationEnvironment().AUTH_BASE_URL ?? 'http://localhost:3000',
      inviteUrl = `${base}/crew/invite/${token}`;
    const guards = [
      memberGuard(user, m.crewId),
      {
        sql: '(SELECT count(*) FROM app_crew_invites WHERE inviter_user_id=? AND created_at>?)<?',
        values: [user, now - 86400000, CREW_DAILY_INVITE_LIMIT] as unknown[],
      },
    ];
    if (invitee)
      guards.push({
        sql: "NOT EXISTS(SELECT 1 FROM app_crew_members WHERE crew_id=? AND user_id=? AND status='ACTIVE')",
        values: [m.crewId, invitee],
      });
    const writes = [
      this.s.statement(
        'INSERT INTO app_crew_invites(id,crew_id,inviter_user_id,invitee_user_id,recipient_hash,recipient_hint,token_hash,channel,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [
          id,
          m.crewId,
          user,
          invitee,
          recipientHash,
          hint,
          tokenHash(token),
          input.channel,
          now + 7 * 86400000,
          now,
          now,
        ],
      ),
    ];
    if (invitee)
      writes.push(
        await socialNotification(this.s, invitee, `crew-invite:${id}`, {
          eventId: `crew-invite:${id}`,
          dedupeKey: `crew-invite:${id}`,
          type: 'FRIENDS',
          category: 'FRIENDS',
          title: 'Crew invite',
          body: `${crew.inviter_name} invited you to join ${crew.name}.`,
          deepLink: `/crew/invite/${token}`,
          priority: 'HIGH',
          pushEligible: true,
        }),
      );
    await guardedBatch(
      this.s,
      guards,
      writes,
      'Invite is duplicate, unavailable or exceeds the daily limit.',
    );
    let delivery: { state: string; reason?: string } = { state: 'PENDING' };
    if (invitee) {
      await drainSocialNotifications(this.s);
      delivery = {
        state:
          (
            await this.s.rows<any>('SELECT status FROM app_social_notification_outbox WHERE id=?', [
              `crew-invite:${id}`,
            ])
          )[0]?.status === 'DONE'
            ? 'DELIVERED'
            : 'PENDING',
      };
    } else if (input.channel === 'SMS' && normalized)
      delivery = await crewSmsProvider.send({
        recipient: normalized,
        inviterName: crew.inviter_name,
        inviteUrl,
      });
    else if (input.channel === 'EMAIL' && normalized)
      delivery = await crewEmailProvider.send({
        recipient: normalized,
        inviterName: crew.inviter_name,
        inviteUrl,
      });
    await this.s
      .statement(
        'UPDATE app_crew_invites SET delivery_state=?,last_sent_at=?,updated_at=? WHERE id=?',
        [delivery.state, now, now, id],
      )
      .run();
    return { id, token, inviteUrl, delivery };
  }
  async inspectCrewInvite(token: string) {
    const [r] = await this.s.rows<any>(
      "SELECT i.id,i.status,i.expires_at AS expiresAt,c.name,c.team_abbr AS teamAbbr,(SELECT count(*) FROM app_crew_members WHERE crew_id=c.id AND status='ACTIVE') AS memberCount,u.display_name AS inviterName FROM app_crew_invites i JOIN app_crews c ON c.id=i.crew_id JOIN app_users u ON u.id=i.inviter_user_id WHERE i.token_hash=? LIMIT 1",
      [tokenHash(token)],
    );
    return r ? { ...r, expiresAt: new Date(r.expiresAt) } : null;
  }
  async acceptCrewInvite(user: string, token: string) {
    const [i] = await this.s.rows<any>('SELECT * FROM app_crew_invites WHERE token_hash=?', [
      tokenHash(token),
    ]);
    if (!i) throw Error('Invite is no longer available.');
    const allowed = canAcceptCrewInvite({
      status: i.status,
      expiresAt: new Date(i.expires_at),
      inviteeUserId: i.invitee_user_id,
      userId: user,
    });
    if (!allowed.ok) throw Error(allowed.reason);
    const now = Date.now();
    await guardedBatch(
      this.s,
      [
        {
          sql: "EXISTS(SELECT 1 FROM app_crew_invites WHERE id=? AND status='PENDING' AND expires_at>? AND (invitee_user_id IS NULL OR invitee_user_id=?))",
          values: [i.id, now, user],
        },
        {
          sql: "NOT EXISTS(SELECT 1 FROM app_crew_members WHERE user_id=? AND status='ACTIVE' AND crew_id<>?)",
          values: [user, i.crew_id],
        },
      ],
      [
        this.s.statement(
          "INSERT INTO app_crew_members(id,crew_id,user_id,role,status,joined_at,created_at,updated_at) VALUES(?,?,?,'MEMBER','ACTIVE',?,?,?) ON CONFLICT(crew_id,user_id) DO UPDATE SET status='ACTIVE',joined_at=excluded.joined_at,updated_at=excluded.updated_at",
          [crypto.randomUUID(), i.crew_id, user, now, now, now],
        ),
        this.s.statement(
          "UPDATE app_crew_invites SET status='ACCEPTED',accepted_at=?,invitee_user_id=?,updated_at=? WHERE id=?",
          [now, user, now, i.id],
        ),
        this.s.statement(
          "INSERT INTO app_crew_activity(id,crew_id,actor_user_id,type,metadata,created_at) VALUES(?,?,?,'MEMBER_JOINED','{}',?)",
          [crypto.randomUUID(), i.crew_id, user, now],
        ),
      ],
    );
    return { crewId: i.crew_id };
  }
  async getCrewShareRecipients(user: string) {
    const [c] = await this.s.rows<any>(
      "SELECT c.id,c.name FROM app_crews c JOIN app_crew_members m ON m.crew_id=c.id WHERE m.user_id=? AND m.status='ACTIVE'",
      [user],
    );
    if (!c) return { crew: null, recipients: [] };
    const recipients = await this.s.rows<any>(
      "SELECT u.id,u.display_name AS displayName,u.avatar_url AS avatarUrl FROM app_crew_members m JOIN app_users u ON u.id=m.user_id WHERE m.crew_id=? AND m.status='ACTIVE' AND m.user_id<>? ORDER BY u.display_name,u.id",
      [c.id, user],
    );
    return { crew: { id: c.id, name: c.name }, recipients };
  }
  async shareToCrew(
    user: string,
    input: {
      contentId: string;
      contentType: string;
      href: string;
      title: string;
      message?: string;
      recipientIds: string[];
    },
  ) {
    const m = await this.requireCrewMember(user),
      audience = await this.getCrewShareRecipients(user),
      { recipientIds, visibility } = resolveCrewShareAudience(
        audience.recipients.map((r) => r.id),
        input.recipientIds,
      ),
      id = crypto.randomUUID(),
      now = Date.now(),
      [sender] = await this.s.rows<any>('SELECT display_name FROM app_users WHERE id=?', [user]);
    const guards = [
      memberGuard(user, m.crewId),
      {
        sql: "(SELECT count(*) FROM app_crew_members WHERE crew_id=? AND status='ACTIVE' AND user_id IN(SELECT value FROM json_each(?)))=?",
        values: [m.crewId, JSON.stringify(recipientIds), recipientIds.length] as unknown[],
      },
    ];
    if (visibility === 'CREW')
      guards.push({
        sql: "(SELECT count(*) FROM app_crew_members WHERE crew_id=? AND status='ACTIVE' AND user_id<>?)=?",
        values: [m.crewId, user, recipientIds.length],
      });
    const writes = [
      this.s.statement(
        'INSERT INTO app_crew_shares(id,crew_id,sender_user_id,visibility,content_id,content_type,href,title,message,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [
          id,
          m.crewId,
          user,
          visibility,
          input.contentId,
          input.contentType,
          input.href,
          input.title,
          input.message?.slice(0, 120) ?? null,
          now,
        ],
      ),
      this.s.statement(
        'INSERT INTO app_crew_share_recipients(share_id,user_id,created_at) SELECT ?,value,? FROM json_each(?)',
        [id, now, JSON.stringify(recipientIds)],
      ),
    ];
    if (visibility === 'CREW')
      writes.push(
        this.s.statement(
          "INSERT INTO app_crew_activity(id,crew_id,actor_user_id,type,content_id,content_type,href,message,metadata,created_at) VALUES(?,?,?,'CONTENT_SHARED',?,?,?,?,?,?)",
          [
            id,
            m.crewId,
            user,
            input.contentId,
            input.contentType,
            input.href,
            input.message?.slice(0, 120) ?? null,
            JSON.stringify({ title: input.title, shareId: id }),
            now,
          ],
        ),
      );
    const disabled = await this.s.rows<any>(
        "SELECT user_id FROM app_notification_preferences WHERE category='CREW_ACTIVITY' AND channel='IN_APP' AND enabled=0 AND user_id IN(SELECT value FROM json_each(?))",
        [JSON.stringify(recipientIds)],
      ),
      recipients = recipientIds.filter((r) => !disabled.some((d) => d.user_id === r));
    writes.push(
      await socialNotificationBatch(
        this.s,
        user,
        `crew-share:${id}`,
        recipients.map((recipient) => ({
          user: recipient,
          input: {
            eventId: `crew-share:${id}:${recipient}`,
            dedupeKey: `crew-share:${id}:${recipient}`,
            type: 'FRIENDS',
            category: 'FRIENDS',
            title: `${sender?.display_name ?? 'A friend'} shared ${input.contentType === 'FILM_ROOM' ? 'a video' : 'a story'} with ${visibility === 'CREW' ? 'the Crew' : 'you'}`,
            body: input.message ? `${input.title} — ${input.message}` : input.title,
            deepLink: input.href,
            contentId: id,
            contentType: 'CREW_SHARE',
            priority: 'NORMAL',
          },
        })),
      ),
    );
    await guardedBatch(this.s, guards, writes);
    await drainSocialNotifications(this.s);
    return { id, visibility, notified: recipients.length };
  }
  async reactToActivity(user: string, id: string, reaction: 'FIRE' | 'LAUGH' | 'EYES' | 'LIKE') {
    await this.s
      .statement(
        "INSERT INTO app_crew_reactions(activity_id,user_id,reaction,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM app_crew_activity a JOIN app_crew_members m ON m.crew_id=a.crew_id WHERE a.id=? AND m.user_id=? AND m.status='ACTIVE') ON CONFLICT DO NOTHING",
        [id, user, reaction, Date.now(), id, user],
      )
      .run();
  }
  async updateCrew(user: string, input: z.infer<typeof crewUpdateSchema>) {
    const m = await this.requireCrewMember(user);
    let photo: string | null = null;
    const guards = [memberGuard(user, m.crewId, true)];
    if (input.photoMediaId) {
      guards.push({
        sql: 'EXISTS(SELECT 1 FROM app_crew_media WHERE id=? AND crew_id=? AND uploader_user_id=?)',
        values: [input.photoMediaId, m.crewId, user],
      });
      photo = `/api/crew/media/${input.photoMediaId}`;
    }
    await guardedBatch(
      this.s,
      guards,
      [
        this.s.statement(
          'UPDATE app_crews SET name=coalesce(?,name),team_abbr=coalesce(?,team_abbr),photo_url=coalesce(?,photo_url),updated_at=? WHERE id=? AND owner_user_id=?',
          [input.name ?? null, input.teamAbbr ?? null, photo, Date.now(), m.crewId, user],
        ),
      ],
      'Only the Crew owner can edit this Crew with an owned photo.',
    );
  }
  async leaveCrew(user: string) {
    const rows = await this.s.rows<any>(
      "UPDATE app_crew_members SET status='LEFT',updated_at=? WHERE user_id=? AND status='ACTIVE' AND role<>'OWNER' RETURNING id",
      [Date.now(), user],
    );
    if (!rows.length) throw Error('Crew owners cannot leave until ownership is transferred.');
  }
  async saveCrewMedia(user: string, mime: string, bytes: Buffer) {
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(mime) ||
      !bytes.length ||
      bytes.length > 2097152
    )
      throw Error('Invalid Crew photo');
    const m = await this.requireCrewMember(user),
      id = crypto.randomUUID(),
      hash = await this.s.put({
        schema: 1,
        owner: user,
        crewId: m.crewId,
        id,
        mime,
        body: bytes.toString('base64'),
      });
    await guardedBatch(
      this.s,
      [memberGuard(user, m.crewId)],
      [
        this.s.statement(
          'INSERT INTO app_crew_media(id,crew_id,uploader_user_id,mime_type,object_hash,bytes,created_at) VALUES(?,?,?,?,?,?,?)',
          [id, m.crewId, user, mime, hash, bytes.length, Date.now()],
        ),
      ],
    );
    return { id, url: `/api/crew/media/${id}` };
  }
  async getMedia(user: string, id: string) {
    const [r] = await this.s.rows<any>(
      "SELECT media.* FROM app_crew_media media JOIN app_crew_members m ON m.crew_id=media.crew_id WHERE media.id=? AND m.user_id=? AND m.status='ACTIVE'",
      [id, user],
    );
    if (!r) return null;
    const p = await this.s.get<any>(r.object_hash);
    if (
      p.schema !== 1 ||
      p.owner !== r.uploader_user_id ||
      p.id !== id ||
      p.crewId !== r.crew_id ||
      p.mime !== r.mime_type
    )
      throw Error('Crew media ownership mismatch');
    const content = Buffer.from(p.body, 'base64');
    if (content.length !== r.bytes) throw Error('Crew media length mismatch');
    if(!(await this.s.rows("SELECT 1 FROM app_crew_members WHERE crew_id=? AND user_id=? AND status='ACTIVE'",[r.crew_id,user])).length)return null;
    return { content, mime_type: r.mime_type };
  }
  async createCrewPost(user: string, input: z.infer<typeof crewPostSchema>) {
    const m = await this.requireCrewMember(user),
      id = crypto.randomUUID(),
      guards = [memberGuard(user, m.crewId)];
    let photo: string | undefined;
    if (input.kind === 'PHOTO') {
      guards.push({
        sql: 'EXISTS(SELECT 1 FROM app_crew_media WHERE id=? AND crew_id=? AND uploader_user_id=?)',
        values: [input.mediaId!, m.crewId, user],
      });
      photo = `/api/crew/media/${input.mediaId}`;
    }
    await guardedBatch(this.s, guards, [
      this.s.statement(
        'INSERT INTO app_crew_activity(id,crew_id,actor_user_id,type,message,href,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)',
        [
          id,
          m.crewId,
          user,
          'POST_' + input.kind,
          input.message || null,
          input.kind === 'LINK' ? input.href! : null,
          JSON.stringify(photo ? { photoUrl: photo } : {}),
          Date.now(),
        ],
      ),
    ]);
    return { id };
  }
  async commentOnCrewActivity(user: string, id: string, message: string) {
    const m = await this.requireCrewMember(user),
      result = await this.s.rows<any>(
        "INSERT INTO app_crew_comments(id,activity_id,user_id,message,created_at) SELECT ?,id,?,?,? FROM app_crew_activity a WHERE a.id=? AND a.crew_id=? AND EXISTS(SELECT 1 FROM app_crew_members m WHERE m.user_id=? AND m.crew_id=a.crew_id AND m.status='ACTIVE') RETURNING id",
        [crypto.randomUUID(), user, message, Date.now(), id, m.crewId, user],
      );
    if (!result.length) throw Error('Post not found in your Crew.');
  }
  async deleteCrewPost(user: string, id: string) {
    const m = await this.requireCrewMember(user);
    await guardedBatch(
      this.s,
      [
        memberGuard(user, m.crewId),
        {
          sql: "EXISTS(SELECT 1 FROM app_crew_activity WHERE id=? AND crew_id=? AND type IN('POST_TEXT','POST_PHOTO','POST_LINK') AND (actor_user_id=? OR ?='OWNER'))",
          values: [id, m.crewId, user, m.role],
        },
      ],
      [this.s.statement('DELETE FROM app_crew_activity WHERE id=?', [id])],
      'You cannot delete this post.',
    );
  }
  async removeCrewMember(user: string, target: string) {
    const m = await this.requireCrewMember(user);
    await guardedBatch(
      this.s,
      [
        memberGuard(user, m.crewId, true),
        {
          sql: "EXISTS(SELECT 1 FROM app_crew_members WHERE crew_id=? AND user_id=? AND status='ACTIVE' AND role<>'OWNER')",
          values: [m.crewId, target],
        },
      ],
      [
        this.s.statement(
          "UPDATE app_crew_members SET status='REMOVED',updated_at=? WHERE crew_id=? AND user_id=?",
          [Date.now(), m.crewId, target],
        ),
      ],
      'This member cannot be removed.',
    );
  }
}
