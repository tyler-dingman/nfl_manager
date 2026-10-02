import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { authenticatedFetch } from '../lib/auth';
import { useTeamBranding } from '../lib/team-branding';
import {
  triviaCountdown,
  triviaEventLive,
  triviaEventTime,
  type ScheduledTriviaEvent,
} from '../../../src/features/trivia/scheduled-event';
export function TriviaEvent() {
  const { teamId, theme } = useTeamBranding();
  const [event, setEvent] = useState<ScheduledTriviaEvent | null>(null),
    [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const activeTeam = useRef(teamId);
  activeTeam.current = teamId;
  useEffect(() => {
    const controller = new AbortController();
    setEvent(null);
    setError('');
    const load = async () => {
      try {
        const r = await authenticatedFetch(
          `/api/trivia/events?team=${encodeURIComponent(teamId)}`,
          { signal: controller.signal },
        );
        if (r.ok) {
          const body = await r.json();
          if (!controller.signal.aborted) setEvent(body.event);
        }
      } catch {
        /* Keep the current event during a transient poll failure. */
      }
    };
    void load();
    const poll = setInterval(load, 15000),
      tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      controller.abort();
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [teamId]);
  if (!event || event.status === 'COMPLETED' || now >= Date.parse(event.endsAt)) return null;
  const live = triviaEventLive(event, now);
  const join = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const team = teamId;
    try {
      const r = await authenticatedFetch(`/api/trivia/events/${event.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: live ? 'join' : 'register' }),
      });
      const body = await r.json();
      if (activeTeam.current !== team) return;
      if (!r.ok) throw new Error(body.error ?? 'Unable to join. Please try again.');
      if (body.gameId)
        router.push({ pathname: '/trivia-game', params: { mode: 'shared', gameId: body.gameId } });
      else setEvent({ ...event, registered: true });
    } catch (e) {
      if (activeTeam.current === team) setError(e instanceof Error ? e.message : 'Unable to join.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View
      style={{
        padding: 18,
        borderWidth: 1,
        borderColor: '#284451',
        borderRadius: 10,
        marginVertical: 16,
      }}
    >
      <Text style={{ color: 'white', fontFamily: 'BarlowCondensed', fontSize: 26 }}>
        UPCOMING TRIVIA
      </Text>
      <Text style={{ color: '#A8BAC4', marginTop: 8 }}>{triviaEventTime(event, now)}</Text>
      <Text
        style={{ color: 'white', fontFamily: 'BarlowCondensed', fontSize: 36, marginVertical: 14 }}
      >
        {live ? 'LIVE NOW' : triviaCountdown(event.startsAt, now).join(' : ')}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy || (event.registered && !live)}
        onPress={() => void join()}
        style={{ backgroundColor: theme.primaryFill, borderRadius: 8, padding: 14 }}
      >
        <Text style={{ color: theme.onPrimary, textAlign: 'center', fontWeight: '800' }}>
          {busy ? 'PLEASE WAIT' : live ? 'JOIN LIVE' : event.registered ? 'YOU’RE IN' : 'SIGN UP →'}
        </Text>
      </Pressable>
      <Text style={{ color: '#A8BAC4', marginTop: 12 }}>
        {event.registrationCount} fans registered
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: 'white', marginTop: 12 }}>
          {error}
        </Text>
      )}
    </View>
  );
}
