import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createGameDayRoom, gameDayAction, getGameDayRoom } from '../lib/api';
import { useTeam } from '../lib/team-context';
import type { GameDayRoom } from '../lib/types';
import { C, Heading } from '../components/screen';
const reactions = ['🔥', '😂', '😤', '🤦', '🍺', '👀'],
  drives = ['TOUCHDOWN', 'FIELD_GOAL', 'PUNT', 'TURNOVER'];
export default function GameDay() {
  const { teamId } = useTeam(),
    [room, setRoom] = useState<GameDayRoom | null>(null),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const load = useCallback(
    async (id?: string) => {
      setLoading(true);
      try {
        setRoom(await getGameDayRoom(teamId, id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Game Day unavailable.');
      } finally {
        setLoading(false);
      }
    },
    [teamId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const roomId = room?.id;
  useEffect(() => {
    if (!roomId) return;
    const timer = setInterval(() => void load(roomId), 2500);
    return () => clearInterval(timer);
  }, [roomId, load]);
  const act = async (body: object) => {
    if (!room) return;
    try {
      await gameDayAction(room.id, body);
      await load(room.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Try again.');
    }
  };
  if (!room)
    return (
      <View style={s.empty}>
        <Heading>Game Day</Heading>
        <Text style={s.intro}>Open a private digital tailgate for {teamId} game day.</Text>
        <Pressable
          style={s.primary}
          onPress={async () => {
            const id = await createGameDayRoom(teamId);
            await load(id);
          }}
        >
          <Text style={s.primaryText}>CREATE A TAILGATE</Text>
        </Pressable>
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>
    );
  const g = room.gameState,
    live = room.status === 'LIVE';
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(room.id)} />}
    >
      <View style={s.score}>
        <Text style={s.phase}>
          {room.status === 'POSTGAME'
            ? 'POSTGAME GARAGE'
            : room.status === 'HALFTIME'
              ? 'HALFTIME'
              : live
                ? 'WATCH PARTY'
                : 'TAILGATE OPEN'}
        </Text>
        <Text style={s.match}>
          {g.awayTeamId} {g.awayScore} · {g.homeTeamId} {g.homeScore}
        </Text>
        <Text style={s.situation}>
          {live
            ? `Q${g.quarter} · ${g.clock} · ${g.possessionTeamId || '—'} BALL`
            : `ROOM ${room.joinCode}`}
        </Text>
      </View>
      <View style={s.members}>
        <Text style={s.label}>WHO&apos;S HERE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {room.members.map((m) => (
            <View key={m.userId} style={s.person}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{m.displayName[0]}</Text>
              </View>
              <Text style={s.name}>{m.displayName}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={s.predict}>
        <Text style={s.phase}>{live ? 'CALL THE DRIVE' : 'WHO WINS?'}</Text>
        <View style={s.grid}>
          {(live ? drives : [g.awayTeamId, g.homeTeamId]).map((x) => (
            <Pressable
              key={x}
              style={s.choice}
              onPress={() =>
                act({
                  action: 'PREDICT',
                  kind: live ? 'DRIVE' : 'PREGAME',
                  prompt: live ? 'DRIVE RESULT' : 'WHO WINS?',
                  selection: x,
                })
              }
            >
              <Text style={s.choiceText}>{x.replace('_', ' ')}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={s.label}>ROOM ACTIVITY</Text>
      {room.activity.map((a) => (
        <View key={a.id} style={[s.activity, a.kind === 'MOMENT' && s.moment]}>
          <Text style={s.meta}>{a.kind === 'MOMENT' ? 'GAME MOMENT' : a.displayName || 'D&D'}</Text>
          <Text style={[s.activityText, a.kind === 'MOMENT' && { color: C.white }]}>{a.body}</Text>
          <View style={s.reactions}>
            {reactions.map((r) => (
              <Pressable
                key={r}
                onPress={() => act({ action: 'REACTION', activityId: a.id, reaction: r })}
              >
                <Text style={s.react}>
                  {r} {a.reactions[r] || ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <View style={s.composer}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Talk trash…"
          style={s.input}
        />
        <Pressable
          style={s.send}
          onPress={() => {
            if (message.trim())
              void act({ action: 'MESSAGE', body: message.trim() }).then(() => setMessage(''));
          }}
        >
          <Text style={s.sendText}>SEND</Text>
        </Pressable>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { backgroundColor: C.cream },
  body: { padding: 16, paddingBottom: 50, gap: 14 },
  empty: { flex: 1, backgroundColor: C.cream, padding: 22, justifyContent: 'center' },
  intro: { color: C.muted, fontSize: 16, lineHeight: 23, marginTop: 10 },
  primary: {
    backgroundColor: C.red,
    borderRadius: 28,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryText: { color: C.white, fontWeight: '900' },
  score: { backgroundColor: C.navy, borderRadius: 22, padding: 22 },
  phase: { color: C.gold, fontSize: 13, fontWeight: '900', letterSpacing: 1.3 },
  match: { color: C.white, fontSize: 30, fontWeight: '900', marginTop: 12 },
  situation: { color: '#B8C2CA', fontWeight: '800', marginTop: 8 },
  members: { backgroundColor: C.white, borderRadius: 18, padding: 16 },
  label: { fontSize: 13, fontWeight: '900', letterSpacing: 1.3, color: C.red },
  person: { alignItems: 'center', marginRight: 16, marginTop: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '900', color: C.navy },
  name: { fontSize: 13, fontWeight: '800', marginTop: 5 },
  predict: { backgroundColor: C.red, borderRadius: 20, padding: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  choice: {
    width: '48%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: { color: C.white, fontSize: 13, fontWeight: '900' },
  activity: { backgroundColor: C.white, borderRadius: 16, padding: 15 },
  moment: { backgroundColor: C.navy },
  meta: { color: C.red, fontSize: 13, fontWeight: '900', letterSpacing: 0.9 },
  activityText: { color: C.ink, fontWeight: '800', marginTop: 5 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  react: { fontSize: 13 },
  composer: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, height: 54, borderRadius: 27, backgroundColor: C.white, paddingHorizontal: 18 },
  send: {
    height: 54,
    borderRadius: 27,
    backgroundColor: C.red,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  sendText: { color: C.white, fontWeight: '900', fontSize: 13 },
  error: { color: '#B91C1C', fontWeight: '800', marginTop: 12 },
});
