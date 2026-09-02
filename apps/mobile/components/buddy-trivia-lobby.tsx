import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  API_BASE_URL,
  createTriviaGroup,
  getTriviaGroup,
  joinTriviaGroup,
  startTriviaGroup,
} from '../lib/api';
import type { TriviaGroupRoom } from '../lib/types';
import { C, Eyebrow, Heading } from './screen';

export function BuddyTriviaLobby({
  teamId,
  onLaunch,
}: {
  teamId: string;
  onLaunch(gameId: string): void;
}) {
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<TriviaGroupRoom | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!room?.joinCode || room.status !== 'WAITING') return;
    const poll = async () => {
      try {
        const next = await getTriviaGroup(room.joinCode);
        setRoom(next);
        if (next.status === 'ACTIVE') onLaunch(next.gameId);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to refresh the room.');
      }
    };
    const timer = setInterval(() => void poll(), 2000);
    return () => clearInterval(timer);
  }, [onLaunch, room?.joinCode, room?.status]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update the room.'); }
    finally { setBusy(false); }
  };

  if (!room) return (
    <View>
      <Eyebrow>LIVE COMPETITION</Eyebrow>
      <Heading>Play with buddies</Heading>
      <Text style={s.copy}>Create a room for 2–5 players or enter a code from your buddy.</Text>
      <Pressable
        disabled={busy}
        style={s.primary}
        onPress={() => void run(async () => {
          const created = await createTriviaGroup(teamId);
          setCode(created.joinCode);
          setInviteToken(created.inviteToken);
          setRoom(await getTriviaGroup(created.joinCode));
        })}
      ><Text style={s.primaryText}>{busy ? 'CREATING…' : 'CREATE TRIVIA ROOM'}</Text></Pressable>
      <Text style={s.or}>OR JOIN A ROOM</Text>
      <TextInput
        value={code}
        onChangeText={(value) => setCode(value.toUpperCase())}
        placeholder="DND-0000"
        placeholderTextColor={C.muted}
        autoCapitalize="characters"
        style={s.input}
      />
      <Pressable
        disabled={busy || code.trim().length < 4}
        style={[s.secondary, (busy || code.trim().length < 4) && s.disabled]}
        onPress={() => void run(async () => {
          await joinTriviaGroup(code.trim());
          setRoom(await getTriviaGroup(code.trim()));
        })}
      ><Text style={s.secondaryText}>JOIN ROOM</Text></Pressable>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );

  const ready = room.participants.filter((participant) => participant.status === 'JOINED').length;
  return (
    <View>
      <Eyebrow>WAITING FOR THE CREW</Eyebrow>
      <Heading>Room {room.joinCode}</Heading>
      <Text style={s.copy}>{ready}/5 ready · At least two players are required.</Text>
      {room.participants.map((participant) => (
        <View key={participant.id} style={s.player}>
          <Text style={s.playerName}>{participant.name}</Text>
          <Text style={participant.status === 'JOINED' ? s.ready : s.waiting}>
            {participant.status === 'JOINED' ? 'READY' : 'WAITING'}
          </Text>
        </View>
      ))}
      <Pressable
        style={s.primary}
        onPress={() => void Share.share({
          title: 'Down & Distance Trivia',
          message: inviteToken
            ? `Join my Down & Distance Trivia room: ${API_BASE_URL}/trivia/join/${inviteToken}`
            : `Join my Down & Distance Trivia room with code ${room.joinCode}`,
        })}
      ><Text style={s.primaryText}>SHARE ROOM CODE</Text></Pressable>
      {room.isHost ? (
        <Pressable
          disabled={busy || ready < 2}
          style={[s.secondary, ready < 2 && s.disabled]}
          onPress={() => void run(async () => onLaunch((await startTriviaGroup(room.joinCode)).gameId))}
        ><Text style={s.secondaryText}>{busy ? 'STARTING…' : 'START TRIVIA'}</Text></Pressable>
      ) : <Text style={s.waitingCopy}>Waiting for the host to start.</Text>}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  copy: { color: C.muted, fontSize: 16, lineHeight: 23, marginTop: 12, marginBottom: 22 },
  primary: { backgroundColor: C.red, borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 12 },
  primaryText: { color: C.white, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  secondary: { borderColor: C.navy, borderWidth: 2, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 12 },
  secondaryText: { color: C.navy, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  disabled: { opacity: 0.4 },
  or: { color: C.muted, fontSize: 13, fontWeight: '900', textAlign: 'center', marginVertical: 20 },
  input: { backgroundColor: C.white, color: C.ink, borderColor: '#CFD7DD', borderWidth: 1, borderRadius: 14, fontSize: 18, fontWeight: '900', letterSpacing: 2, padding: 16, textAlign: 'center' },
  player: { backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 9, flexDirection: 'row', justifyContent: 'space-between' },
  playerName: { color: C.ink, fontSize: 16, fontWeight: '900' },
  ready: { color: '#18864B', fontSize: 13, fontWeight: '900' },
  waiting: { color: C.muted, fontSize: 13, fontWeight: '900' },
  waitingCopy: { color: C.muted, fontSize: 15, textAlign: 'center', marginTop: 20 },
  error: { color: C.red, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 16 },
});
