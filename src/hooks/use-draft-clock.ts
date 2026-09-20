'use client';
import * as React from 'react';
import { DraftClock } from '@/lib/draft-clock';

type UseDraftClockParams = {
  clockKey: string | null;
  enabled: boolean;
  durationSeconds: number;
  rate?: number;
  onExpire: () => void | Promise<void>;
};

export const useDraftClock = ({
  clockKey,
  enabled,
  durationSeconds,
  rate = 1,
  onExpire,
}: UseDraftClockParams) => {
  const [secondsRemaining, setSecondsRemaining] = React.useState(durationSeconds);
  const clock = React.useRef<DraftClock | null>(null);
  const expired = React.useRef(false);
  const callback = React.useRef(onExpire);
  callback.current = onExpire;
  React.useLayoutEffect(() => {
    clock.current = new DraftClock(durationSeconds, performance.now());
    expired.current = false;
    setSecondsRemaining(durationSeconds);
  }, [clockKey, durationSeconds]);
  React.useLayoutEffect(() => {
    const current = clock.current;
    if (!current) return;
    current.configure(performance.now(), enabled && Boolean(clockKey), rate);
    if (enabled) expired.current = false;
    const tick = () => {
      const remaining = current.tick(performance.now());
      setSecondsRemaining(Math.ceil(remaining / 1000));
      if (enabled && clockKey && remaining === 0 && !expired.current) {
        expired.current = true;
        void callback.current();
      }
    };
    tick();
    if (!enabled || !clockKey) return;
    const timer = window.setInterval(tick, 100);
    return () => {
      current.configure(performance.now(), false, rate);
      window.clearInterval(timer);
    };
  }, [clockKey, durationSeconds, enabled, rate]);
  return {
    secondsRemaining,
    isCritical: enabled && secondsRemaining <= 20,
    progressPct:
      durationSeconds > 0
        ? Math.max(0, Math.min(100, (secondsRemaining / durationSeconds) * 100))
        : 0,
  };
};
