import { createHash, randomUUID } from 'node:crypto';

import { secureToken, tokenHash } from '@/server/auth/crypto';
import { authDb } from '@/server/auth/database';
import { createNotification } from '@/server/notifications/repository';
import {
  canAcceptCrewInvite,
  CREW_DAILY_INVITE_LIMIT,
  normalizeCrewInviteRecipient,
} from '@/features/crew/policy';
import { crewEmailProvider, crewSmsProvider } from './delivery';
import { resolveCrewShareAudience } from '@/features/crew/share-selection';

const recipientHash = (value: string) =>
  createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
const hint = (value: string) =>
  value.includes('@')
    ? value.replace(/^(.{1,2}).*(@.*)$/, '$1•••$2')
    : `•••${value.replace(/\D/g, '').slice(-4)}`;

export async function getCrewForUser(userId: string) {
  const sql = authDb();
  const crews = await sql<
    any[]
  >`SELECT c.*,m.role FROM crews c JOIN crew_members m ON m.crew_id=c.id
    WHERE m.user_id=${userId} AND m.status='ACTIVE' LIMIT 1`;
  const crew = crews[0];
  if (!crew) return null;
  const [members, activity, invites, rank] = await Promise.all([
    sql<
      any[]
    >`SELECT u.id,u.display_name AS "displayName",u.avatar_url AS "avatarUrl",m.role,m.joined_at AS "joinedAt",
        COALESCE(SUM(e.yards) FILTER (WHERE e.created_at>=date_trunc('week',now())),0)::int AS "weeklyYards",
        COALESCE(a.lifetime_yards,0)::int AS "lifetimeYards"
        FROM crew_members m JOIN users u ON u.id=m.user_id LEFT JOIN move_the_chains_events e ON e.user_id=u.id
        LEFT JOIN move_the_chains_accounts a ON a.user_id=u.id
        WHERE m.crew_id=${crew.id} AND m.status='ACTIVE' GROUP BY u.id,m.role,m.joined_at,a.lifetime_yards
        ORDER BY "weeklyYards" DESC,u.display_name`,
    sql<
      any[]
    >`SELECT a.id,a.type,a.content_id AS "contentId",a.content_type AS "contentType",a.href,a.message,a.metadata,
        a.created_at AS "createdAt",u.display_name AS "actorName",u.avatar_url AS "actorAvatar",
        COALESCE(jsonb_agg(jsonb_build_object('reaction',r.reaction,'userId',r.user_id)) FILTER (WHERE r.user_id IS NOT NULL),'[]') AS reactions
        FROM crew_activity a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN crew_reactions r ON r.activity_id=a.id
        WHERE a.crew_id=${crew.id} GROUP BY a.id,u.display_name,u.avatar_url ORDER BY a.created_at DESC LIMIT 30`,
    sql<
      any[]
    >`SELECT id,channel,status,delivery_state AS "deliveryState",recipient_hint AS "recipientHint",created_at AS "createdAt",expires_at AS "expiresAt"
        FROM crew_invites WHERE crew_id=${crew.id} AND status='PENDING' ORDER BY created_at DESC`,
    sql<
      any[]
    >`WITH totals AS (SELECT c.id,COALESCE(SUM(e.yards) FILTER (WHERE e.created_at>=date_trunc('week',now())),0) yards
        FROM crews c LEFT JOIN crew_members m ON m.crew_id=c.id AND m.status='ACTIVE' LEFT JOIN move_the_chains_events e ON e.user_id=m.user_id GROUP BY c.id)
        SELECT position::int FROM (SELECT id,row_number() OVER(ORDER BY yards DESC) position FROM totals) x WHERE id=${crew.id}`,
  ]);
  return {
    id: crew.id,
    name: crew.name,
    teamAbbr: crew.team_abbr,
    ownerUserId: crew.owner_user_id,
    role: crew.role,
    members,
    activity,
    pendingInvites: invites,
    weeklyYards: members.reduce((sum: any, m: any) => sum + Number(m.weeklyYards), 0),
    rank: rank[0]?.position ?? 1,
  };
}

export async function createCrew(userId: string, input: { name: string; teamAbbr: string }) {
  return authDb().begin(async (tx) => {
    const existing =
      await tx`SELECT 1 FROM crew_members WHERE user_id=${userId} AND status='ACTIVE'`;
    if (existing.length) throw new Error('You already belong to a Crew.');
    const id = randomUUID();
    await tx`INSERT INTO crews(id,name,team_abbr,owner_user_id) VALUES(${id},${input.name},${input.teamAbbr},${userId})`;
    await tx`INSERT INTO crew_members(id,crew_id,user_id,role,status,joined_at) VALUES(${randomUUID()},${id},${userId},'OWNER','ACTIVE',now())`;
    await tx`INSERT INTO crew_activity(id,crew_id,actor_user_id,type,metadata) VALUES(${randomUUID()},${id},${userId},'CREW_CREATED','{}')`;
    return { id };
  });
}

export async function createCrewInvite(
  userId: string,
  input: {
    channel: 'IN_APP' | 'SMS' | 'EMAIL' | 'SHARE_LINK';
    recipient?: string;
    inviteeUserId?: string;
  },
) {
  const sql = authDb();
  const crewRows = await sql<
    any[]
  >`SELECT c.id,c.name,u.display_name AS inviter_name FROM crews c JOIN crew_members m ON m.crew_id=c.id JOIN users u ON u.id=${userId}
    WHERE m.user_id=${userId} AND m.status='ACTIVE' AND (m.role='OWNER' OR m.role='MEMBER') LIMIT 1`;
  const crew = crewRows[0];
  if (!crew) throw new Error('Create or join a Crew first.');
  const recent = await sql<
    any[]
  >`SELECT count(*)::int count FROM crew_invites WHERE inviter_user_id=${userId} AND created_at>now()-interval '24 hours'`;
  if (recent[0].count >= CREW_DAILY_INVITE_LIMIT) throw new Error('Daily invite limit reached.');
  let inviteeUserId = input.inviteeUserId ?? null;
  if (!inviteeUserId && input.channel === 'EMAIL' && input.recipient) {
    const users = await sql<
      any[]
    >`SELECT id FROM users WHERE lower(primary_email)=lower(${input.recipient}) LIMIT 1`;
    inviteeUserId = users[0]?.id ?? null;
  }
  const normalized =
    input.recipient && (input.channel === 'EMAIL' || input.channel === 'SMS')
      ? normalizeCrewInviteRecipient(input.channel, input.recipient)
      : null;
  if (inviteeUserId) {
    const member =
      await sql`SELECT 1 FROM crew_members WHERE crew_id=${crew.id} AND user_id=${inviteeUserId} AND status='ACTIVE'`;
    if (member.length) throw new Error('That person is already in the Crew.');
  }
  const token = secureToken();
  const id = randomUUID();
  const rows = await sql<
    any[]
  >`INSERT INTO crew_invites(id,crew_id,inviter_user_id,invitee_user_id,recipient_hash,recipient_hint,token_hash,channel,expires_at)
    VALUES(${id},${crew.id},${userId},${inviteeUserId},${normalized ? recipientHash(normalized) : null},${normalized ? hint(normalized) : null},${tokenHash(token)},${input.channel},now()+interval '7 days')
    ON CONFLICT DO NOTHING RETURNING id`;
  if (!rows.length) throw new Error('A pending invite already exists for that recipient.');
  const base = process.env.AUTH_BASE_URL ?? 'http://localhost:3000';
  const inviteUrl = `${base}/crew/invite/${token}`;
  let delivery: { state: string; reason?: string } = { state: 'PENDING' };
  if (inviteeUserId) {
    await createNotification(inviteeUserId, {
      eventId: `crew-invite:${id}`,
      dedupeKey: `crew-invite:${id}`,
      type: 'FRIENDS',
      category: 'FRIENDS',
      title: 'Crew invite',
      body: `${crew.inviter_name} invited you to join ${crew.name}.`,
      deepLink: `/crew/invite/${token}`,
      priority: 'HIGH',
      pushEligible: true,
    });
    delivery = { state: 'DELIVERED' };
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
  await sql`UPDATE crew_invites SET delivery_state=${delivery.state},last_sent_at=now(),updated_at=now() WHERE id=${id}`;
  return { id, token, inviteUrl, delivery };
}

export async function inspectCrewInvite(token: string) {
  const rows = await authDb()<
    any[]
  >`SELECT i.id,i.status,i.expires_at AS "expiresAt",c.name,c.team_abbr AS "teamAbbr",
    (SELECT count(*)::int FROM crew_members WHERE crew_id=c.id AND status='ACTIVE') AS "memberCount",u.display_name AS "inviterName"
    FROM crew_invites i JOIN crews c ON c.id=i.crew_id JOIN users u ON u.id=i.inviter_user_id WHERE i.token_hash=${tokenHash(token)} LIMIT 1`;
  return rows[0] ?? null;
}

export async function acceptCrewInvite(userId: string, token: string) {
  return authDb().begin(async (tx) => {
    const rows = await tx<
      any[]
    >`SELECT * FROM crew_invites WHERE token_hash=${tokenHash(token)} FOR UPDATE`;
    const invite = rows[0];
    if (!invite) throw new Error('Invite is no longer available.');
    const allowed = canAcceptCrewInvite({
      status: invite.status,
      expiresAt: new Date(invite.expires_at),
      inviteeUserId: invite.invitee_user_id,
      userId,
    });
    if (!allowed.ok) {
      if (allowed.reason === 'Invite has expired.')
        await tx`UPDATE crew_invites SET status='EXPIRED' WHERE id=${invite.id}`;
      throw new Error(allowed.reason);
    }
    const other =
      await tx`SELECT 1 FROM crew_members WHERE user_id=${userId} AND status='ACTIVE' AND crew_id<>${invite.crew_id}`;
    if (other.length) throw new Error('Leave your current Crew before joining another.');
    await tx`INSERT INTO crew_members(id,crew_id,user_id,role,status,joined_at) VALUES(${randomUUID()},${invite.crew_id},${userId},'MEMBER','ACTIVE',now())
      ON CONFLICT(crew_id,user_id) DO UPDATE SET status='ACTIVE',joined_at=now(),updated_at=now()`;
    await tx`UPDATE crew_invites SET status='ACCEPTED',accepted_at=now(),invitee_user_id=${userId},updated_at=now() WHERE id=${invite.id}`;
    await tx`INSERT INTO crew_activity(id,crew_id,actor_user_id,type,metadata) VALUES(${randomUUID()},${invite.crew_id},${userId},'MEMBER_JOINED','{}')`;
    return { crewId: invite.crew_id };
  });
}

export async function shareToCrew(
  userId: string,
  input: {
    contentId: string;
    contentType: string;
    href: string;
    title: string;
    message?: string;
    recipientIds: string[];
  },
) {
  const sql = authDb();
  const rows = await sql<any[]>`SELECT c.id,u.display_name AS "senderName" FROM crews c
    JOIN crew_members m ON m.crew_id=c.id JOIN users u ON u.id=${userId}
    WHERE m.user_id=${userId} AND m.status='ACTIVE' LIMIT 1`;
  if (!rows[0]) throw new Error('Join a Crew before sharing.');
  const crewId = rows[0].id;
  const eligible = await sql<
    any[]
  >`SELECT user_id AS id FROM crew_members WHERE crew_id=${crewId} AND status='ACTIVE' AND user_id<>${userId}`;
  const { recipientIds: requestedIds, visibility } = resolveCrewShareAudience(
    eligible.map((recipient) => recipient.id),
    input.recipientIds,
  );
  const shareId = randomUUID();
  await sql.begin(async (tx) => {
    await tx`INSERT INTO crew_shares(id,crew_id,sender_user_id,visibility,content_id,content_type,href,title,message)
      VALUES(${shareId},${crewId},${userId},${visibility},${input.contentId},${input.contentType},${input.href},${input.title},${input.message?.slice(0, 120) ?? null})`;
    for (const recipientId of requestedIds)
      await tx`INSERT INTO crew_share_recipients(share_id,user_id) VALUES(${shareId},${recipientId})`;
    if (visibility === 'CREW')
      await tx`INSERT INTO crew_activity(id,crew_id,actor_user_id,type,content_id,content_type,href,message,metadata)
        VALUES(${shareId},${crewId},${userId},'CONTENT_SHARED',${input.contentId},${input.contentType},${input.href},${input.message?.slice(0, 120) ?? null},${tx.json({ title: input.title, shareId })})`;
  });
  const recipients = await sql<any[]>`SELECT m.user_id FROM crew_members m
    WHERE m.crew_id=${crewId} AND m.status='ACTIVE' AND m.user_id=ANY(${requestedIds})
    AND NOT EXISTS(SELECT 1 FROM user_notification_preferences p WHERE p.user_id=m.user_id AND p.category='CREW_ACTIVITY' AND p.channel='IN_APP' AND p.enabled=false)`;
  for (const recipient of recipients)
    await createNotification(recipient.user_id, {
      eventId: `crew-share:${shareId}:${recipient.user_id}`,
      dedupeKey: `crew-share:${shareId}:${recipient.user_id}`,
      type: 'FRIENDS',
      category: 'FRIENDS',
      title: `${rows[0].senderName} shared ${input.contentType === 'FILM_ROOM' ? 'a video' : 'a story'} with ${visibility === 'CREW' ? 'the Crew' : 'you'}`,
      body: input.message ? `${input.title} — ${input.message}` : input.title,
      deepLink: input.href,
      contentId: shareId,
      contentType: 'CREW_SHARE',
      priority: 'NORMAL',
    });
  console.info(
    JSON.stringify({
      metric: 'crew_share_sent',
      recipientMode: visibility,
      recipientCount: requestedIds.length,
      contentType: input.contentType,
    }),
  );
  return { id: shareId, visibility, notified: recipients.length };
}

export async function getCrewShareRecipients(userId: string) {
  const rows = await authDb()<
    any[]
  >`SELECT c.id AS "crewId",c.name AS "crewName",u.id,u.display_name AS "displayName",u.avatar_url AS "avatarUrl"
    FROM crews c JOIN crew_members sender ON sender.crew_id=c.id AND sender.user_id=${userId} AND sender.status='ACTIVE'
    LEFT JOIN crew_members recipient ON recipient.crew_id=c.id AND recipient.status='ACTIVE' AND recipient.user_id<>${userId}
    LEFT JOIN users u ON u.id=recipient.user_id ORDER BY u.display_name`;
  if (!rows.length) return { crew: null, recipients: [] };
  return {
    crew: { id: rows[0].crewId, name: rows[0].crewName },
    recipients: rows
      .filter((row) => row.id)
      .map(({ id, displayName, avatarUrl }) => ({ id, displayName, avatarUrl })),
  };
}

export async function reactToActivity(
  userId: string,
  activityId: string,
  reaction: 'FIRE' | 'LAUGH' | 'EYES' | 'LIKE',
) {
  await authDb()`INSERT INTO crew_reactions(activity_id,user_id,reaction) SELECT ${activityId},${userId},${reaction}
    WHERE EXISTS(SELECT 1 FROM crew_activity a JOIN crew_members m ON m.crew_id=a.crew_id WHERE a.id=${activityId} AND m.user_id=${userId} AND m.status='ACTIVE')
    ON CONFLICT DO NOTHING`;
}

export async function updateCrew(userId: string, input: { name?: string; teamAbbr?: string }) {
  await authDb()`UPDATE crews c SET name=COALESCE(${input.name ?? null},name),team_abbr=COALESCE(${input.teamAbbr ?? null},team_abbr),updated_at=now()
    WHERE owner_user_id=${userId}`;
}

export async function leaveCrew(userId: string) {
  const rows = await authDb()<
    any[]
  >`UPDATE crew_members SET status='LEFT',updated_at=now() WHERE user_id=${userId} AND status='ACTIVE' AND role<>'OWNER' RETURNING id`;
  if (!rows.length) throw new Error('Crew owners cannot leave until ownership is transferred.');
}
