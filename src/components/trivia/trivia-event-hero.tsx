'use client';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, UsersRound } from 'lucide-react';
import { EditorialSectionHero } from '@/components/beat/editorial-section-hero';
import shared from '@/components/beat/beat-hero.module.css';
import styles from './trivia-event-hero.module.css';
import { useAuthUser } from '@/features/auth/auth-session';
import { apiFetch } from '@/lib/api';
import {
  triviaCountdown,
  triviaEventLive,
  triviaEventTime,
  type ScheduledTriviaEvent,
} from '@/features/trivia/scheduled-event';

// Temporary design preview; real scheduled events always take precedence.
// CST is UTC-6 (fixed standard time, rather than October daylight time).
const previewEvent: ScheduledTriviaEvent = {
  id: 'october-1-preview',
  teamId: '',
  startsAt: '2026-10-01T23:00:00.000Z',
  endsAt: '2026-10-01T23:04:00.000Z',
  timezone: 'Etc/GMT+6',
  status: 'SCHEDULED',
  registrationCount: 0,
  registered: false,
};

export function TriviaEventHero({
  teamId,
  onJoin,
  fallback,
}: {
  teamId: string;
  onJoin: (gameId: string) => void;
  fallback: ReactNode;
}) {
  const { user } = useAuthUser();
  const router = useRouter();
  const [data, setData] = useState<{ key: string; event: ScheduledTriviaEvent | null } | null>(
    null,
  );
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = `${teamId}:${user?.id ?? 'guest'}`;
  const activeKey = useRef(key);
  activeKey.current = key;
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    const load = async () => {
      try {
        const r = await apiFetch(`/api/trivia/events?team=${encodeURIComponent(teamId)}`, {
          signal: controller.signal,
        });
        if (!r.ok) return;
        const body = await r.json();
        if (!controller.signal.aborted) setData({ key, event: body.event });
      } catch {}
    };
    void load();
    const poll = setInterval(load, 15000),
      tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      controller.abort();
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [teamId, key]);
  const savedEvent = data?.key === key ? data.event : null;
  const isPreview = !savedEvent;
  const event = savedEvent ?? { ...previewEvent, teamId };
  if (!event || event.status === 'COMPLETED' || now >= Date.parse(event.endsAt))
    return <>{fallback}</>;
  const live = triviaEventLive(event, now);
  const countdown = triviaCountdown(event.startsAt, now);
  const act = async () => {
    if (isPreview) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/trivia?team=${teamId}`)}`);
      return;
    }
    if (busy || (event.registered && !live)) return;
    setBusy(true);
    setError('');
    try {
      const r = await apiFetch(`/api/trivia/events/${event.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: live ? 'join' : 'register' }),
      });
      const result = await r.json();
      if (activeKey.current !== key) return;
      if (!r.ok) throw new Error(result.error || 'Unable to register. Please try again.');
      if (live && result.gameId) {
        onJoin(result.gameId);
        return;
      }
      const updated = await apiFetch(`/api/trivia/events?team=${encodeURIComponent(teamId)}`);
      if (activeKey.current !== key) return;
      if (updated.ok) setData({ key, event: (await updated.json()).event });
      else setData({ key, event: { ...event, registered: true } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <EditorialSectionHero
      variant="trivia"
      teamAbbr={teamId}
      firstWord="FOUR MINUTE"
      accentWord="DRILL"
      taglineLabel="10 questions. 24 seconds."
      tagline={
        <>
          10 QUESTIONS. <tspan className={shared.nickname}>24 SECONDS.</tspan>
        </>
      }
    >
      <h2 className={`dd-three-out-display ${shared.threeTitle}`}>
        UPCOMING <span className="dd-three-out-ampersand">TRIVIA</span>
      </h2>
      <p className={shared.subtitle}>{triviaEventTime(event, now).replace('GMT-6', 'CST')}</p>
      <div className={styles.countdown} aria-label="Time until trivia starts">
        {['HOURS', 'MINUTES', 'SECONDS'].map((label, i) => (
          <div key={label}>
            <strong>{countdown[i]}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={styles.action}
        disabled={isPreview || busy || (!live && event.registered)}
        onClick={act}
      >
        {busy ? 'PLEASE WAIT' : live ? 'JOIN LIVE' : event.registered ? "YOU'RE IN" : 'SIGN UP'}
        {event.registered && !live ? <Check size={20} /> : <ArrowRight size={20} />}
      </button>
      {isPreview ? (
        <p className={styles.fans}>PREVIEW EVENT · REGISTRATION NOT OPEN</p>
      ) : (
        <p className={styles.fans}>
          <UsersRound aria-hidden="true" size={23} />
          {event.registrationCount.toLocaleString()}{' '}
          {event.registrationCount === 1 ? 'FAN' : 'FANS'} ALREADY SIGNED UP
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </EditorialSectionHero>
  );
}
