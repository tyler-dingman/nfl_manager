import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { authDb } from '@/server/auth/database';
import { MAX_BUDDY_PLAYERS } from '@/features/trivia/experience';
import { DRILL_PLAY_CLOCK_SECONDS } from '@/features/trivia/four-minute-drill';
import { ensureTriviaQuestionPool } from '@/server/trivia/question-pool';
async function createSharedGame(
  userId: string,
  mode: 'FRIEND_CHALLENGE' | 'GROUP',
  teamId: string,
  count: 10 = 10,
) {
  await ensureTriviaQuestionPool(teamId, count);
  const sql = authDb();
  return sql.begin(async (tx) => {
    const gameId = randomUUID();
    const questions = await tx<
      Array<{ id: string }>
    >`SELECT id FROM trivia_questions WHERE team_id=${teamId} AND active=true AND (verified=true OR ${process.env.NODE_ENV !== 'production'}) ORDER BY md5(id||${gameId}) LIMIT ${count}`;
    if (questions.length < count) throw new Error('Not enough active questions.');
    await tx`INSERT INTO trivia_games(id,mode,team_id,status,created_by_user_id,question_count,timer_seconds)VALUES(${gameId},${mode},${teamId},${mode === 'GROUP' ? 'WAITING' : 'ACTIVE'},${userId},${count},${DRILL_PLAY_CLOCK_SECONDS})`;
    for (const [i, q] of questions.entries())
      await tx`INSERT INTO trivia_game_questions(game_id,question_id,position)VALUES(${gameId},${q.id},${i + 1})`;
    await tx`INSERT INTO trivia_game_participants(game_id,user_id)VALUES(${gameId},${userId})`;
    return gameId;
  });
}
export async function searchUsers(userId: string, query: string) {
  return authDb()`SELECT id,display_name AS "displayName",avatar_url AS "avatarUrl" FROM users WHERE id<>${userId} AND status='ACTIVE' AND display_name ILIKE ${`%${query}%`} ORDER BY display_name LIMIT 20`;
}
export async function listFriends(userId: string) {
  return authDb()`SELECT f.requester_user_id AS "requesterUserId",f.addressee_user_id AS "addresseeUserId",f.status,f.created_at AS "createdAt",f.accepted_at AS "acceptedAt",u.id AS "userId",u.display_name AS "displayName" FROM trivia_friendships f JOIN users u ON u.id=CASE WHEN f.requester_user_id=${userId} THEN f.addressee_user_id ELSE f.requester_user_id END WHERE f.requester_user_id=${userId} OR f.addressee_user_id=${userId} ORDER BY f.created_at DESC`;
}
export async function requestFriend(userId: string, otherId: string) {
  if (userId === otherId) throw new Error('You cannot add yourself.');
  await authDb()`INSERT INTO trivia_friendships(requester_user_id,addressee_user_id,status)VALUES(${userId},${otherId},'PENDING') ON CONFLICT DO NOTHING`;
  return listFriends(userId);
}
export async function acceptFriend(userId: string, otherId: string) {
  const rows = await authDb()<
    Array<{ requester_user_id: string }>
  >`UPDATE trivia_friendships SET status='ACCEPTED',accepted_at=now() WHERE requester_user_id=${otherId} AND addressee_user_id=${userId} AND status='PENDING' RETURNING requester_user_id`;
  if (!rows[0]) throw new Error('Friend request not found.');
  return listFriends(userId);
}
export async function removeFriend(userId: string, otherId: string) {
  await authDb()`DELETE FROM trivia_friendships WHERE (requester_user_id=${userId} AND addressee_user_id=${otherId}) OR (requester_user_id=${otherId} AND addressee_user_id=${userId})`;
}
export async function createChallenge(
  userId: string,
  challengedId: string,
  teamId: string,
  _count: 5 | 10,
) {
  const gameId = await createSharedGame(userId, 'FRIEND_CHALLENGE', teamId, 10);
  const id = randomUUID();
  await authDb()`INSERT INTO trivia_game_participants(game_id,user_id)VALUES(${gameId},${challengedId}) ON CONFLICT DO NOTHING`;
  await authDb()`INSERT INTO trivia_challenges(id,challenger_user_id,challenged_user_id,game_id,expires_at)VALUES(${id},${userId},${challengedId},${gameId},now()+interval '7 days')`;
  return { id, gameId };
}
export const listChallenges = (userId: string) =>
  authDb()`SELECT c.id,c.challenger_user_id AS "challengerUserId",c.challenged_user_id AS "challengedUserId",c.game_id AS "gameId",c.status,c.expires_at AS "expiresAt",g.team_id AS "teamId",g.question_count AS "questionCount" FROM trivia_challenges c JOIN trivia_games g ON g.id=c.game_id WHERE c.challenger_user_id=${userId} OR c.challenged_user_id=${userId} ORDER BY c.created_at DESC`;
export async function acceptChallenge(userId: string, id: string) {
  const rows = await authDb()<
    Array<{ game_id: string }>
  >`UPDATE trivia_challenges SET status='ACCEPTED' WHERE id=${id} AND challenged_user_id=${userId} AND status='PENDING' AND expires_at>now() RETURNING game_id`;
  if (!rows[0]) throw new Error('Challenge is unavailable.');
  await authDb()`INSERT INTO trivia_game_participants(game_id,user_id)VALUES(${rows[0].game_id},${userId}) ON CONFLICT DO NOTHING`;
  return { gameId: rows[0].game_id };
}
const joinCode = () => `DND-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createGroup(userId: string, teamId: string) {
  const gameId = await createSharedGame(userId, 'GROUP', teamId, 10);
  const inviteToken = randomBytes(24).toString('base64url');
  for (let i = 0; i < 5; i++) {
    const code = joinCode();
    const rows = await authDb()<
      Array<{ id: string }>
    >`INSERT INTO trivia_groups(id,game_id,join_code,host_user_id,invite_token_hash)VALUES(${randomUUID()},${gameId},${code},${userId},${hashToken(inviteToken)}) ON CONFLICT(join_code)DO NOTHING RETURNING id`;
    if (rows[0]) {
      await authDb()`INSERT INTO trivia_invitations(id,game_id,inviter_user_id,invite_token_hash,expires_at) VALUES(${randomUUID()},${gameId},${userId},${hashToken(inviteToken)},now()+interval '24 hours')`;
      return { gameId, joinCode: code, inviteToken };
    }
  }
  throw new Error('Unable to create join code.');
}
export async function joinGroup(userId: string, code: string) {
  return joinGroupWhere(userId, 'code', code.toUpperCase());
}

export async function joinGroupByToken(userId: string, token: string) {
  return joinGroupWhere(userId, 'token', hashToken(token));
}

async function joinGroupWhere(userId: string, kind: 'code' | 'token', value: string) {
  const sql = authDb();
  return sql.begin(async (tx) => {
    const rows = await (kind === 'code'
      ? tx<
          Array<{ gameId: string; status: string }>
        >`SELECT g.game_id AS "gameId",tg.status FROM trivia_groups g JOIN trivia_games tg ON tg.id=g.game_id WHERE g.join_code=${value} AND g.expires_at>now() FOR UPDATE`
      : tx<
          Array<{ gameId: string; status: string }>
        >`SELECT g.game_id AS "gameId",tg.status FROM trivia_groups g JOIN trivia_games tg ON tg.id=g.game_id WHERE g.invite_token_hash=${value} AND g.expires_at>now() FOR UPDATE`);
    const room = rows[0];
    if (!room) throw new Error('Trivia room not found or invitation expired.');
    if (room.status !== 'WAITING') throw new Error('This Trivia game has already started.');
    const existing =
      await tx`SELECT 1 FROM trivia_game_participants WHERE game_id=${room.gameId} AND user_id=${userId}`;
    if (existing[0]) {
      await tx`UPDATE trivia_game_participants SET participant_status='JOINED' WHERE game_id=${room.gameId} AND user_id=${userId}`;
      if (kind === 'token')
        await tx`UPDATE trivia_invitations SET accepted_at=coalesce(accepted_at,now()),invited_user_id=coalesce(invited_user_id,${userId}) WHERE invite_token_hash=${value}`;
      return { gameId: room.gameId, joined: false };
    }
    const count = await tx<
      Array<{ count: number }>
    >`SELECT count(*)::int AS count FROM trivia_game_participants WHERE game_id=${room.gameId}`;
    if ((count[0]?.count ?? 0) >= MAX_BUDDY_PLAYERS) throw new Error('This Trivia room is full.');
    await tx`INSERT INTO trivia_game_participants(game_id,user_id)VALUES(${room.gameId},${userId})`;
    if (kind === 'token')
      await tx`UPDATE trivia_invitations SET accepted_at=coalesce(accepted_at,now()),invited_user_id=coalesce(invited_user_id,${userId}) WHERE invite_token_hash=${value}`;
    return { gameId: room.gameId, joined: true };
  });
}
export async function startGroup(userId: string, code: string) {
  const rows = await authDb()<
    Array<{ game_id: string }>
  >`SELECT game_id FROM trivia_groups WHERE join_code=${code.toUpperCase()} AND host_user_id=${userId}`;
  if (!rows[0]) throw new Error('Only the host can start this group.');
  await authDb()`DELETE FROM trivia_game_participants WHERE game_id=${rows[0].game_id} AND participant_status='INVITED'`;
  const participants = await authDb()<
    Array<{ count: number }>
  >`SELECT count(*)::int AS count FROM trivia_game_participants WHERE game_id=${rows[0].game_id} AND participant_status='JOINED'`;
  if ((participants[0]?.count ?? 0) < 2) throw new Error('At least two players are required.');
  await authDb()`INSERT INTO trivia_rank_snapshots(game_id,user_id,question_position,rank,score) SELECT ${rows[0].game_id},p.user_id,0,row_number() OVER(ORDER BY u.display_name,u.id)::int,0 FROM trivia_game_participants p JOIN users u ON u.id=p.user_id WHERE p.game_id=${rows[0].game_id} AND p.participant_status='JOINED' ON CONFLICT DO NOTHING`;
  await authDb()`UPDATE trivia_games SET status='ACTIVE',started_at=now() WHERE id=${rows[0].game_id} AND status='WAITING'`;
  return { gameId: rows[0].game_id };
}

export async function getGroupRoom(userId: string, code: string) {
  const rows = await authDb()<
    Array<{ gameId: string; joinCode: string; hostUserId: string; status: string }>
  >`SELECT g.game_id AS "gameId",g.join_code AS "joinCode",g.host_user_id AS "hostUserId",tg.status FROM trivia_groups g JOIN trivia_games tg ON tg.id=g.game_id WHERE g.join_code=${code.toUpperCase()}`;
  const room = rows[0];
  if (!room) throw new Error('Group not found.');
  const participants =
    await authDb()`SELECT u.id,coalesce(u.display_name,'Football Fan') AS name,p.participant_status AS status,p.score,p.correct_answers AS "correctAnswers",p.wrong_answers AS "wrongAnswers",p.timeouts,p.response_time_total_ms AS "responseTimeTotalMs",p.best_question_score AS "bestQuestionScore" FROM trivia_game_participants p JOIN users u ON u.id=p.user_id WHERE p.game_id=${room.gameId} ORDER BY p.score DESC,p.correct_answers DESC,u.display_name,u.id`;
  return { ...room, isHost: room.hostUserId === userId, participants };
}

export async function getGroupRoomByToken(userId: string, token: string) {
  const rows = await authDb()<
    Array<{ gameId: string; joinCode: string; hostUserId: string; status: string; teamId: string }>
  >`SELECT g.game_id AS "gameId",g.join_code AS "joinCode",g.host_user_id AS "hostUserId",tg.status,tg.team_id AS "teamId" FROM trivia_groups g JOIN trivia_games tg ON tg.id=g.game_id WHERE g.invite_token_hash=${hashToken(token)} AND g.expires_at>now()`;
  const room = rows[0];
  if (!room) throw new Error('Trivia invitation is invalid or expired.');
  const participants =
    await authDb()`SELECT u.id,coalesce(u.display_name,'Football Fan') AS name,p.participant_status AS status,p.score,p.correct_answers AS "correctAnswers",p.wrong_answers AS "wrongAnswers",p.timeouts,p.response_time_total_ms AS "responseTimeTotalMs",p.best_question_score AS "bestQuestionScore" FROM trivia_game_participants p JOIN users u ON u.id=p.user_id WHERE p.game_id=${room.gameId} ORDER BY p.score DESC,p.correct_answers DESC,u.display_name,u.id`;
  return { ...room, isHost: room.hostUserId === userId, participants };
}

export async function inviteUserToGroup(hostUserId: string, code: string, invitedUserId: string) {
  const sql = authDb();
  return sql.begin(async (tx) => {
    const rooms = await tx<
      Array<{ gameId: string }>
    >`SELECT g.game_id AS "gameId" FROM trivia_groups g JOIN trivia_games tg ON tg.id=g.game_id WHERE g.join_code=${code.toUpperCase()} AND g.host_user_id=${hostUserId} AND tg.status='WAITING' AND g.expires_at>now() FOR UPDATE`;
    const room = rooms[0];
    if (!room) throw new Error('Only the host can invite buddies to this room.');
    const count = await tx<
      Array<{ count: number }>
    >`SELECT count(*)::int AS count FROM trivia_game_participants WHERE game_id=${room.gameId}`;
    if ((count[0]?.count ?? 0) >= MAX_BUDDY_PLAYERS) throw new Error('This Trivia room is full.');
    await tx`INSERT INTO trivia_game_participants(game_id,user_id,participant_status) VALUES(${room.gameId},${invitedUserId},'INVITED') ON CONFLICT(game_id,user_id) DO NOTHING`;
    return { gameId: room.gameId };
  });
}

export async function createGroupRematch(hostUserId: string, completedGameId: string) {
  const games = await authDb()<
    Array<{ teamId: string }>
  >`SELECT team_id AS "teamId" FROM trivia_games WHERE id=${completedGameId} AND created_by_user_id=${hostUserId} AND mode='GROUP'`;
  if (!games[0]) throw new Error('Only the host can run this game back.');
  const priorPlayers = await authDb()<
    Array<{ userId: string }>
  >`SELECT user_id AS "userId" FROM trivia_game_participants WHERE game_id=${completedGameId} AND user_id<>${hostUserId}`;
  const room = await createGroup(hostUserId, games[0].teamId);
  for (const player of priorPlayers.slice(0, MAX_BUDDY_PLAYERS - 1))
    await authDb()`INSERT INTO trivia_game_participants(game_id,user_id,participant_status) VALUES(${room.gameId},${player.userId},'INVITED') ON CONFLICT DO NOTHING`;
  return room;
}
