'use client';

import * as React from 'react';

type UseDraftClockParams = {
  clockKey: string | null;
  enabled: boolean;
  durationSeconds: number;
  onExpire: () => void | Promise<void>;
};

export const useDraftClock = ({
  clockKey,
  enabled,
  durationSeconds,
  onExpire,
}: UseDraftClockParams) => {
  const [secondsRemaining, setSecondsRemaining] = React.useState(durationSeconds);
  const deadlineRef = React.useRef<number | null>(null);
  const expiredRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!clockKey || !enabled) {
      deadlineRef.current = null;
      setSecondsRemaining(durationSeconds);
      return;
    }

    deadlineRef.current = Date.now() + durationSeconds * 1000;
    expiredRef.current = null;
    setSecondsRemaining(durationSeconds);
  }, [clockKey, durationSeconds, enabled]);

  React.useEffect(() => {
    if (!clockKey || !enabled || deadlineRef.current === null) {
      return;
    }

    const tick = () => {
      if (deadlineRef.current === null) return;
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0 && expiredRef.current !== clockKey) {
        expiredRef.current = clockKey;
        void onExpire();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [clockKey, enabled, onExpire]);

  return {
    secondsRemaining,
    isCritical: enabled && secondsRemaining <= 20,
    progressPct:
      durationSeconds <= 0
        ? 0
        : Math.max(0, Math.min(100, (secondsRemaining / durationSeconds) * 100)),
  };
};
