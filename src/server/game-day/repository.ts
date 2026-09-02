import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { authDb } from '@/server/auth/database';
import { sendPush } from '@/server/notifications/push';
import {
  applySimulation,
  roomStatusForGame,
  type GameDayRoom,
  type GameState,
  type SimulationAction,
} from '../../../packages/game-day';

const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const code = () => randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
const opponent = (team: string) => (team === 'KC' ? 'LV' : team === 'LV' ? 'KC' : 'KC');

export async function createRoom(userId: string, teamId: string) {
  const id = randomUUID(),
    inviteToken = randomBytes(24).toString('base64url'),
    joinCode = code();
  const kickoff = new Date(Date.now() + 90 * 60_000),
    away = teamId,
    home = opponent(teamId);
  const gameState: GameState = {
    gameId: `demo-${teamId}-${kickoff.toISOString().slice(0, 10)}`,
    status: 'PREGAME',
    homeTeamId: home,
    awayTeamId: away,
    homeScore: 0,
    awayScore: 0,
    quarter: 0,
    clock: '15:00',
    possessionTeamId: null,
    down: null,
    distance: null,
    yardLine: null,
    redZone: false,
    lastPlay: null,
    driveNumber: 0,
    updatedAt: new Date().toISOString(),
  };
  await authDb().begin(async (tx) => {
    await tx`INSERT INTO game_day_rooms(id,game_id,team_id,host_user_id,name,join_code,invite_token_hash,kickoff_at,game_state)VALUES(${id},${gameState.gameId},${teamId},${userId},${`${teamId} Game Day`},${joinCode},${hash(inviteToken)},${kickoff},${tx.json(gameState as any)})`;
    await tx`INSERT INTO game_day_room_members(room_id,user_id,role)VALUES(${id},${userId},'HOST')`;
    await tx`INSERT INTO game_day_activity(id,room_id,kind,body,payload)VALUES(${randomUUID()},${id},'SYSTEM',${'Your private tailgate is open.'},${tx.json({})})`;
  });
  return { id, joinCode, inviteToken };
}
export async function joinRoom(userId: string, value: string) {
  const tokenHash = hash(value);
  const rows = await authDb()<
    Array<{ id: string; hostUserId: string; teamId: string }>
  >`SELECT id,host_user_id AS "hostUserId",team_id AS "teamId" FROM game_day_rooms WHERE join_code=${value.toUpperCase()} OR invite_token_hash=${tokenHash} LIMIT 1`;
  if (!rows[0]) throw new Error('Tailgate not found.');
  await authDb()`INSERT INTO game_day_room_members(room_id,user_id)VALUES(${rows[0].id},${userId}) ON CONFLICT(room_id,user_id) DO UPDATE SET presence='HERE',last_seen_at=now()`;
  if (rows[0].hostUserId !== userId) {
    const people = await authDb()<Array<{ displayName: string }>>`
      SELECT coalesce(display_name,'A friend') AS "displayName" FROM users WHERE id=${userId}`;
    void sendPush({
      userId: rows[0].hostUserId,
      title: 'Down & Distance',
      body: `${people[0]?.displayName ?? 'A friend'} joined the tailgate.`,
      destination: `/game-day?room=${rows[0].id}`,
      data: { roomId: rows[0].id, teamId: rows[0].teamId },
    }).catch(() => undefined);
  }
  return { id: rows[0].id };
}
export async function activeRoom(userId: string, teamId?: string) {
  const sql = authDb();
  const rows = teamId
    ? await sql<
        Array<{ id: string }>
      >`SELECT r.id FROM game_day_rooms r JOIN game_day_room_members m ON m.room_id=r.id WHERE m.user_id=${userId} AND r.status<>'ARCHIVED' AND r.team_id=${teamId} ORDER BY r.updated_at DESC LIMIT 1`
    : await sql<
        Array<{ id: string }>
      >`SELECT r.id FROM game_day_rooms r JOIN game_day_room_members m ON m.room_id=r.id WHERE m.user_id=${userId} AND r.status<>'ARCHIVED' ORDER BY r.updated_at DESC LIMIT 1`;
  return rows[0] ? getRoom(userId, rows[0].id) : null;
}
export async function getRoom(userId: string, roomId: string): Promise<GameDayRoom> {
  const sql = authDb();
  const rooms = await sql<
    any[]
  >`SELECT r.* FROM game_day_rooms r JOIN game_day_room_members m ON m.room_id=r.id WHERE r.id=${roomId} AND m.user_id=${userId}`;
  const r = rooms[0];
  if (!r) throw new Error('Tailgate not found or unavailable.');
  await sql`UPDATE game_day_room_members SET last_seen_at=now(),presence='HERE' WHERE room_id=${roomId} AND user_id=${userId}`;
  const [members, activity, predictions, reactions] = await Promise.all([
    sql<
      any[]
    >`SELECT m.user_id AS "userId",coalesce(u.display_name,'Football Fan') AS "displayName",m.role,m.presence,m.joined_at AS "joinedAt" FROM game_day_room_members m JOIN users u ON u.id=m.user_id WHERE m.room_id=${roomId} ORDER BY m.joined_at`,
    sql<
      any[]
    >`SELECT a.id,a.kind,a.user_id AS "userId",u.display_name AS "displayName",a.body,a.payload,a.created_at AS "createdAt" FROM game_day_activity a LEFT JOIN users u ON u.id=a.user_id WHERE a.room_id=${roomId} ORDER BY a.created_at DESC LIMIT 100`,
    sql<
      any[]
    >`SELECT id,user_id AS "userId",kind,prompt,selection,drive_number AS "driveNumber",settled_at IS NOT NULL AS settled,correct FROM game_day_predictions WHERE room_id=${roomId} ORDER BY created_at`,
    sql<
      any[]
    >`SELECT activity_id AS "activityId",reaction,count(*)::int AS count FROM game_day_reactions WHERE activity_id IN(SELECT id FROM game_day_activity WHERE room_id=${roomId}) GROUP BY activity_id,reaction`,
  ]);
  const by = new Map<string, Record<string, number>>();
  for (const x of reactions) {
    const v = by.get(x.activityId) || {};
    v[x.reaction] = x.count;
    by.set(x.activityId, v);
  }
  return {
    id: r.id,
    gameId: r.game_id,
    teamId: r.team_id,
    hostUserId: r.host_user_id,
    name: r.name,
    joinCode: r.join_code,
    inviteToken: '',
    privacy: r.privacy,
    status: r.status,
    kickoffAt: r.kickoff_at.toISOString(),
    gameState: r.game_state,
    members,
    activity: activity.reverse().map((a) => ({ ...a, reactions: by.get(a.id) || {} })),
    predictions,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}
export async function addMessage(
  userId: string,
  roomId: string,
  body: string,
  kind = 'MESSAGE',
  payload: Record<string, unknown> = {},
) {
  await assertMember(userId, roomId);
  await authDb()`INSERT INTO game_day_activity(id,room_id,kind,user_id,body,payload)VALUES(${randomUUID()},${roomId},${kind},${userId},${body},${authDb().json(payload as any)})`;
  await touch(roomId);
}
export async function react(userId: string, roomId: string, activityId: string, reaction: string) {
  await assertMember(userId, roomId);
  await authDb()`INSERT INTO game_day_reactions(activity_id,user_id,reaction)SELECT ${activityId},${userId},${reaction} WHERE EXISTS(SELECT 1 FROM game_day_activity WHERE id=${activityId} AND room_id=${roomId}) ON CONFLICT DO NOTHING`;
}
export async function predict(
  userId: string,
  roomId: string,
  kind: 'PREGAME' | 'DRIVE',
  prompt: string,
  selection: string,
) {
  const room = await getRoom(userId, roomId);
  if (kind === 'PREGAME' && ['LIVE', 'HALFTIME', 'POSTGAME'].includes(room.status))
    throw new Error('Pregame picks are locked.');
  const drive = kind === 'DRIVE' ? room.gameState.driveNumber : null;
  await authDb()`INSERT INTO game_day_predictions(id,room_id,user_id,kind,prompt,selection,drive_number)VALUES(${randomUUID()},${roomId},${userId},${kind},${prompt},${selection},${drive}) ON CONFLICT(room_id,user_id,kind,prompt,drive_number) DO UPDATE SET selection=EXCLUDED.selection`;
}
export async function simulate(userId: string, roomId: string, action: SimulationAction) {
  if (process.env.NODE_ENV === 'production') throw new Error('Simulation is development-only.');
  const sql = authDb();
  await sql.begin(async (tx) => {
    const rows = await tx<
      any[]
    >`SELECT * FROM game_day_rooms WHERE id=${roomId} AND host_user_id=${userId} FOR UPDATE`;
    if (!rows[0]) throw new Error('Only the host can run the simulator.');
    const result = applySimulation(rows[0].game_state, action);
    await tx`UPDATE game_day_rooms SET game_state=${tx.json(result.state as any)},status=${roomStatusForGame(result.state.status)},updated_at=now() WHERE id=${roomId}`;
    if (result.event && result.event.importance >= 70) {
      const eventId = randomUUID();
      await tx`INSERT INTO game_day_events(id,room_id,event_type,team_id,headline,detail,importance,payload)VALUES(${eventId},${roomId},${result.event.type},${result.event.teamId || null},${result.event.headline},${result.event.detail || null},${result.event.importance},${tx.json({ action })})`;
      await tx`INSERT INTO game_day_activity(id,room_id,kind,body,payload)VALUES(${eventId},${roomId},'MOMENT',${result.event.headline},${tx.json({ detail: result.event.detail, eventType: result.event.type, score: `${result.state.awayTeamId} ${result.state.awayScore} · ${result.state.homeTeamId} ${result.state.homeScore}` })})`;
    }
    if (result.driveResult)
      await tx`UPDATE game_day_predictions SET settled_at=now(),correct=(selection=${result.driveResult}) WHERE room_id=${roomId} AND kind='DRIVE' AND drive_number=${result.state.driveNumber} AND settled_at IS NULL`;
  });
}
async function assertMember(userId: string, roomId: string) {
  const r =
    await authDb()`SELECT 1 FROM game_day_room_members WHERE room_id=${roomId} AND user_id=${userId}`;
  if (!r[0]) throw new Error('You are not in this tailgate.');
}
const touch = (roomId: string) =>
  authDb()`UPDATE game_day_rooms SET updated_at=now() WHERE id=${roomId}`;
