import { useCallback, useEffect, useState } from 'react';
import {
  ImageBackground,
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
import { useTeamBranding } from '../lib/team-branding';
import type { GameDayRoom } from '../lib/types';
import { C, Heading } from '../components/screen';
const reactions = ['🔥', '😂', '🤯', '👏', '🏈', '🍻', '❤️', '💩'],
  drives = ['TOUCHDOWN', 'FIELD_GOAL', 'PUNT', 'TURNOVER'];
const KC_STADIUM = require('../../../public/images/gameday/stadium/kc/kc_full.png');
export default function GameDay() {
  const { teamId } = useTeam(),
    { theme } = useTeamBranding(),
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
      <ScrollView style={s.page} contentContainerStyle={s.body}>
        <MobileGameDayHero teamId={teamId} primary={theme.primary} secondary={theme.secondary} />
        <View style={s.infoGrid}>
          <MiniInfo label="WEATHER · PREVIEW" value="78°" detail="Partly cloudy" />
          <MiniInfo label="ODDS · PREVIEW" value={`${teamId} -230`} detail="Fixture data" />
          <MiniInfo label="LOCATION" value="Home" detail="Stadium info" />
        </View>
        <View style={s.emptyCard}>
          <Heading>Your digital tailgate.</Heading>
          <Text style={s.intro}>
            Open a private room to react, predict, and talk with your people.
          </Text>
          <Pressable
            style={[s.primary, { backgroundColor: theme.primary }]}
            onPress={async () => {
              const id = await createGameDayRoom(teamId);
              await load(id);
            }}
          >
            <Text style={s.primaryText}>CREATE A TAILGATE</Text>
          </Pressable>
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    );
  const g = room.gameState,
    live = room.status === 'LIVE';
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(room.id)} />}
    >
      <MobileGameDayHero
        teamId={teamId}
        primary={theme.primary}
        secondary={theme.secondary}
        room={room}
      />
      <View style={s.infoGrid}>
        <MiniInfo label="WEATHER · PREVIEW" value="78°" detail="Partly cloudy" />
        <MiniInfo label="ODDS · PREVIEW" value={`${teamId} -230`} detail="Fixture data" />
        <MiniInfo label="LOCATION" value="Home" detail="Stadium info" />
      </View>
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
function MobileGameDayHero({
  teamId,
  primary,
  secondary,
  room,
}: {
  teamId: string;
  primary: string;
  secondary: string;
  room?: GameDayRoom;
}) {
  const game = room?.gameState,
    live = room?.status === 'LIVE' || room?.status === 'HALFTIME',
    final = room?.status === 'POSTGAME';
  const content = (
    <>
      {teamId === 'KC' ? (
        <View style={s.heroVignette} />
      ) : (
        <View style={[s.heroGlow, { backgroundColor: primary }]} />
      )}
      <View style={s.heroHeadline}>
        <Text style={s.sunday}>SUNDAY</Text>
        <Text style={[s.funday, { color: secondary }]}>FUNDAY</Text>
      </View>
      <View style={s.countdown}>
        <Text style={s.countLabel}>{final ? 'FINAL' : live ? 'GAME STATUS' : 'KICKOFF IN'}</Text>
        <Text style={s.countValue}>
          {live || final
            ? `${game?.awayTeamId} ${game?.awayScore} · ${game?.homeTeamId} ${game?.homeScore}`
            : '08 : 35 : 42'}
        </Text>
        <Text style={s.countDetail}>
          {live ? `Q${game?.quarter} · ${game?.clock}` : `${teamId} GAME DAY · PREVIEW`}
        </Text>
      </View>
      <Text style={s.atmosphere}>TAILGATE ATMOSPHERE · SIMULATED</Text>
      <View style={s.progress}>
        <View style={[s.progressFill, { backgroundColor: secondary }]} />
      </View>
    </>
  );
  return teamId === 'KC' ? (
    <ImageBackground
      source={KC_STADIUM}
      resizeMode="cover"
      imageStyle={s.heroImage}
      style={[s.hero, { borderColor: secondary }]}
    >
      {content}
    </ImageBackground>
  ) : (
    <View style={[s.hero, { borderColor: secondary }]}>{content}</View>
  );
}
function MiniInfo({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={s.miniInfo}>
      <Text style={s.miniLabel}>{label}</Text>
      <Text style={s.miniValue}>{value}</Text>
      <Text style={s.miniDetail}>{detail}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  page: { backgroundColor: C.cream },
  body: { padding: 16, paddingBottom: 50, gap: 14 },
  emptyCard: { backgroundColor: C.white, borderRadius: 20, padding: 20 },
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
  hero: {
    overflow: 'hidden',
    minHeight: 360,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: '#080D11',
    padding: 22,
    justifyContent: 'space-between',
  },
  heroGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    right: -90,
    top: 35,
    opacity: 0.28,
  },
  heroImage: { resizeMode: 'cover' },
  heroVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,8,11,.42)',
  },
  heroHeadline: { marginTop: 24 },
  sunday: { color: C.white, fontSize: 47, lineHeight: 47, fontWeight: '900', letterSpacing: -2 },
  funday: {
    fontSize: 48,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: -2,
  },
  countdown: {
    backgroundColor: 'rgba(0,0,0,.72)',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  countLabel: { color: '#AEB8BE', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  countValue: { color: C.white, fontSize: 31, fontWeight: '900', marginTop: 8 },
  countDetail: { color: '#C8D0D4', fontSize: 12, fontWeight: '800', marginTop: 6 },
  atmosphere: { color: '#AEB8BE', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  progress: { height: 5, borderRadius: 4, backgroundColor: '#42494D' },
  progressFill: { height: 5, width: '25%', borderRadius: 4 },
  infoGrid: { flexDirection: 'row', gap: 8 },
  miniInfo: { flex: 1, minHeight: 120, borderRadius: 16, backgroundColor: '#111517', padding: 12 },
  miniLabel: { color: '#929DA3', fontSize: 9, fontWeight: '900' },
  miniValue: { color: C.white, fontSize: 18, fontWeight: '900', marginTop: 12 },
  miniDetail: { color: '#AEB8BE', fontSize: 11, marginTop: 5 },
});
