import { Storage } from './core';
import { guardedBatch, iso } from './atomic';
import { createHash, randomBytes } from 'node:crypto';
import {
  applySimulation,
  roomStatusForGame,
  type GameDayRoom,
  type GameState,
  type SimulationAction,
} from '../game-day';
import { sendPush } from '../../src/server/notifications/push';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export class D1GameDay {
  constructor(readonly s: Storage) {}
  member(user: string, room: string) {
    return {
      sql: 'EXISTS(SELECT 1 FROM app_game_day_room_members WHERE room_id=? AND user_id=?)',
      values: [room, user],
    };
  }
  async createRoom(user: string, team: string) {
    const now = Date.now(),
      id = crypto.randomUUID(),
      inviteToken = randomBytes(24).toString('base64url'),
      joinCode = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(),
      kickoff = now + 90 * 60000;
    const state: GameState = {
      gameId: `demo-${team}-${new Date(kickoff).toISOString().slice(0, 10)}`,
      status: 'PREGAME',
      homeTeamId: team === 'KC' ? 'LV' : 'KC',
      awayTeamId: team,
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
      updatedAt: iso(now)!,
    };
    await this.s.batch([
      this.s.statement(
        'INSERT INTO app_game_day_rooms(id,game_id,team_id,host_user_id,name,join_code,invite_token_hash,kickoff_at,game_state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        [
          id,
          state.gameId,
          team,
          user,
          `${team} Game Day`,
          joinCode,
          hash(inviteToken),
          kickoff,
          JSON.stringify(state),
          now,
          now,
        ],
      ),
      this.s.statement(
        "INSERT INTO app_game_day_room_members(room_id,user_id,role,joined_at,last_seen_at) VALUES(?,?,'HOST',?,?)",
        [id, user, now, now],
      ),
      this.s.statement(
        "INSERT INTO app_game_day_activity(id,room_id,kind,body,payload,created_at) VALUES(?,?,'SYSTEM','Your private tailgate is open.','{}',?)",
        [crypto.randomUUID(), id, now],
      ),
    ]);
    return { id, joinCode, inviteToken };
  }
  async joinRoom(user: string, value: string) {
    const [r] = await this.s.rows<any>(
      'SELECT id,host_user_id,team_id FROM app_game_day_rooms WHERE join_code=? OR invite_token_hash=? LIMIT 1',
      [value.toUpperCase(), hash(value)],
    );
    if (!r) throw Error('Tailgate not found.');
    const now = Date.now();
    await this.s
      .statement(
        "INSERT INTO app_game_day_room_members(room_id,user_id,joined_at,last_seen_at) VALUES(?,?,?,?) ON CONFLICT(room_id,user_id) DO UPDATE SET presence='HERE',last_seen_at=excluded.last_seen_at",
        [r.id, user, now, now],
      )
      .run();
    if (r.host_user_id !== user) {
      const [u] = await this.s.rows<any>('SELECT display_name FROM app_users WHERE id=?', [user]);
      void sendPush({
        userId: r.host_user_id,
        title: 'Down & Distance',
        body: `${u?.display_name ?? 'A friend'} joined the tailgate.`,
        destination: `/game-day?room=${r.id}`,
        data: { roomId: r.id, teamId: r.team_id },
      }).catch(() => undefined);
    }
    return { id: r.id };
  }
  async activeRoom(user: string, team?: string) {
    const [r] = await this.s.rows<any>(
      "SELECT r.id FROM app_game_day_rooms r JOIN app_game_day_room_members m ON m.room_id=r.id WHERE m.user_id=? AND r.status<>'ARCHIVED'" +
        (team ? ' AND r.team_id=?' : '') +
        ' ORDER BY r.updated_at DESC,r.id LIMIT 1',
      team ? [user, team] : [user],
    );
    return r ? this.getRoom(user, r.id) : null;
  }
  async getRoom(user: string, room: string): Promise<GameDayRoom> {
    const [r] = await this.s.rows<any>(
      'SELECT r.* FROM app_game_day_rooms r JOIN app_game_day_room_members m ON m.room_id=r.id WHERE r.id=? AND m.user_id=?',
      [room, user],
    );
    if (!r) throw Error('Tailgate not found or unavailable.');
    await this.s
      .statement(
        "UPDATE app_game_day_room_members SET last_seen_at=?,presence='HERE' WHERE room_id=? AND user_id=?",
        [Date.now(), room, user],
      )
      .run();
    const [members, activity, predictions, reactions] = await Promise.all([
      this.s.rows<any>(
        "SELECT m.user_id AS userId,coalesce(u.display_name,'Football Fan') AS displayName,m.role,m.presence,m.joined_at AS joinedAt FROM app_game_day_room_members m JOIN app_users u ON u.id=m.user_id WHERE m.room_id=? ORDER BY m.joined_at,m.user_id",
        [room],
      ),
      this.s.rows<any>(
        'SELECT a.id,a.kind,a.user_id AS userId,u.display_name AS displayName,a.body,a.payload,a.created_at AS createdAt FROM app_game_day_activity a LEFT JOIN app_users u ON u.id=a.user_id WHERE a.room_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT 100',
        [room],
      ),
      this.s.rows<any>(
        'SELECT id,user_id AS userId,kind,prompt,selection,drive_number AS driveNumber,settled_at IS NOT NULL AS settled,correct FROM app_game_day_predictions WHERE room_id=? ORDER BY created_at,id',
        [room],
      ),
      this.s.rows<any>(
        'SELECT activity_id AS activityId,reaction,count(*) AS count FROM app_game_day_reactions WHERE activity_id IN(SELECT id FROM app_game_day_activity WHERE room_id=?) GROUP BY activity_id,reaction',
        [room],
      ),
    ]);
    const by = new Map<string, Record<string, number>>();
    for (const v of reactions) {
      const counts = by.get(v.activityId) ?? {};
      counts[v.reaction] = v.count;
      by.set(v.activityId, counts);
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
      kickoffAt: iso(r.kickoff_at)!,
      gameState: JSON.parse(r.game_state),
      members: members.map((m) => ({ ...m, joinedAt: iso(m.joinedAt) })),
      activity: activity
        .reverse()
        .map((a) => ({
          ...a,
          payload: JSON.parse(a.payload),
          createdAt: iso(a.createdAt),
          reactions: by.get(a.id) ?? {},
        })),
      predictions: predictions.map((p) => ({
        ...p,
        settled: Boolean(p.settled),
        correct: p.correct == null ? null : Boolean(p.correct),
      })),
      createdAt: iso(r.created_at)!,
      updatedAt: iso(r.updated_at)!,
    };
  }
  async addMessage(
    user: string,
    room: string,
    body: string,
    kind = 'MESSAGE',
    payload: Record<string, unknown> = {},
  ) {
    const now = Date.now();
    await guardedBatch(
      this.s,
      [this.member(user, room)],
      [
        this.s.statement(
          'INSERT INTO app_game_day_activity(id,room_id,kind,user_id,body,payload,created_at) VALUES(?,?,?,?,?,?,?)',
          [crypto.randomUUID(), room, kind, user, body, JSON.stringify(payload), now],
        ),
        this.s.statement('UPDATE app_game_day_rooms SET updated_at=? WHERE id=?', [now, room]),
      ],
      'You are not in this tailgate.',
    );
  }
  async react(user: string, room: string, activity: string, reaction: string) {
    await guardedBatch(
      this.s,
      [this.member(user, room)],
      [
        this.s.statement(
          'INSERT INTO app_game_day_reactions(activity_id,user_id,reaction) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM app_game_day_activity WHERE id=? AND room_id=?) ON CONFLICT DO NOTHING',
          [activity, user, reaction, activity, room],
        ),
      ],
      'You are not in this tailgate.',
    );
  }
  async predict(
    user: string,
    room: string,
    kind: 'PREGAME' | 'DRIVE',
    prompt: string,
    selection: string,
  ) {
    const snapshot = await this.getRoom(user, room),
      drive = kind === 'DRIVE' ? snapshot.gameState.driveNumber : null,
      now = Date.now();
    await guardedBatch(
      this.s,
      [
        this.member(user, room),
        {
          sql: "EXISTS(SELECT 1 FROM app_game_day_rooms WHERE id=? AND (?<>'PREGAME' OR status NOT IN('LIVE','HALFTIME','POSTGAME')) AND json_extract(game_state,'$.driveNumber')=?)",
          values: [room, kind, snapshot.gameState.driveNumber],
        },
      ],
      [
        this.s.statement(
          'UPDATE app_game_day_predictions SET selection=? WHERE room_id=? AND user_id=? AND kind=? AND prompt=? AND drive_number IS ?',
          [selection, room, user, kind, prompt, drive],
        ),
        this.s.statement(
          'INSERT INTO app_game_day_predictions(id,room_id,user_id,kind,prompt,selection,drive_number,created_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM app_game_day_predictions WHERE room_id=? AND user_id=? AND kind=? AND prompt=? AND drive_number IS ?)',
          [
            crypto.randomUUID(),
            room,
            user,
            kind,
            prompt,
            selection,
            drive,
            now,
            room,
            user,
            kind,
            prompt,
            drive,
          ],
        ),
      ],
      'Picks are locked or the drive changed.',
    );
  }
  async simulate(user: string, room: string, action: SimulationAction) {
    if (process.env.NODE_ENV === 'production') throw Error('Simulation is development-only.');
    const [r] = await this.s.rows<any>(
      'SELECT * FROM app_game_day_rooms WHERE id=? AND host_user_id=?',
      [room, user],
    );
    if (!r) throw Error('Only the host can run the simulator.');
    const result = applySimulation(JSON.parse(r.game_state), action),
      now = Date.now(),
      writes = [
        this.s.statement(
          'UPDATE app_game_day_rooms SET game_state=?,status=?,updated_at=?,version=version+1 WHERE id=?',
          [JSON.stringify(result.state), roomStatusForGame(result.state.status), now, room],
        ),
      ];
    if (result.event && result.event.importance >= 70) {
      const id = crypto.randomUUID();
      writes.push(
        this.s.statement(
          'INSERT INTO app_game_day_events(id,room_id,event_type,team_id,headline,detail,importance,payload,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
          [
            id,
            room,
            result.event.type,
            result.event.teamId ?? null,
            result.event.headline,
            result.event.detail ?? null,
            result.event.importance,
            JSON.stringify({ action }),
            now,
          ],
        ),
        this.s.statement(
          "INSERT INTO app_game_day_activity(id,room_id,kind,body,payload,created_at) VALUES(?,?,'MOMENT',?,?,?)",
          [
            id,
            room,
            result.event.headline,
            JSON.stringify({
              detail: result.event.detail,
              eventType: result.event.type,
              score: `${result.state.awayTeamId} ${result.state.awayScore} · ${result.state.homeTeamId} ${result.state.homeScore}`,
            }),
            now,
          ],
        ),
      );
    }
    if (result.driveResult)
      writes.push(
        this.s.statement(
          "UPDATE app_game_day_predictions SET settled_at=?,correct=(selection=?) WHERE room_id=? AND kind='DRIVE' AND drive_number=? AND settled_at IS NULL",
          [now, result.driveResult, room, result.state.driveNumber],
        ),
      );
    await guardedBatch(
      this.s,
      [
        {
          sql: 'EXISTS(SELECT 1 FROM app_game_day_rooms WHERE id=? AND host_user_id=? AND version=?)',
          values: [room, user, r.version],
        },
      ],
      writes,
    );
  }
}
