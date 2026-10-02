export type Hooks = {
  useState<T>(initial: T | (() => T)): [T, (next: T | ((value: T) => T)) => void];
  useRef<T>(initial: T): { current: T };
  useEffect(effect: () => void | (() => void), dependencies: readonly unknown[]): void;
  useCallback<T extends (...args: any[]) => any>(callback: T, dependencies: readonly unknown[]): T;
};
import { validateMessage } from './message';
import type { Snapshot } from './index';
const empty = (): Snapshot => ({
  game: null,
  messages: [],
  polls: [],
  participants: null,
  cursor: '',
  before: null,
  hiddenUsers: [],
  voted: {},
  liked: [],
  canModerate: false,
});

/** No network or timers. Simulator fixtures are loaded only in development. */
export function createUseHuddle({ useEffect, useRef, useState }: Hooks) {
  return function useHuddle(query: string, _request?: unknown, _isActive?: unknown) {
    const enabled = process.env.NODE_ENV === 'development';
    const params = new URLSearchParams(query);
    const gamePreview = params.get('mode') === 'gameday' || !!params.get('game');
    const [step, setStep] = useState(0);
    const snapshot = (index: number): Snapshot => {
      if (process.env.NODE_ENV !== 'development') return empty();
      if (params.get('archive')) {
        const { archiveSnapshot } = require('./demo-archive') as typeof import('./demo-archive');
        return archiveSnapshot(
          params.get('team') ?? 'KC',
          params.get('teamName') ?? 'Kansas City Chiefs',
          params.get('date') ?? '2026-09-27',
        );
      }
      if (!gamePreview) {
        const { dailySnapshot } = require('./demo-daily') as typeof import('./demo-daily');
        return dailySnapshot(
          params.get('team') ?? 'KC',
          params.get('teamName') ?? params.get('team') ?? 'Kansas City Chiefs',
        );
      }
      const { demoSnapshot } = require('./demo-game') as typeof import('./demo-game');
      return demoSnapshot(index);
    };
    const [data, setData] = useState<Snapshot | null>(() => snapshot(0));
    useEffect(() => {
      setData(snapshot(step));
    }, [step, enabled, query]);
    // Local-only concept interactions. Production actions remain disabled.
    const act = async (body: object) => {
      if (!enabled || !data || (!gamePreview && !data.daily?.fixture)) return false;
      const b = body as {
        action: string;
        id?: string;
        userId?: string;
        enabled?: boolean;
        choice?: number;
        body?: string;
        clientId?: string;
        name?: string;
        avatar?: string;
        media?: import('../gifs').GifReference;
        resolvedGif?: import('../gifs').GifItem;
        replyTo?: string;
      };
      if (data.daily?.status === 'ARCHIVED' && ['like', 'vote', 'message'].includes(b.action))
        return false;
      if (b.action === 'message') {
        try {
          validateMessage(b);
        } catch {
          return false;
        }
      }
      if (
        b.action === 'vote' &&
        (!data.polls.some(
          (p) =>
            p.id === b.id &&
            !p.closed &&
            Number.isInteger(b.choice) &&
            b.choice! >= 0 &&
            b.choice! < p.options.length,
        ) ||
          data.voted[b.id!] !== undefined)
      )
        return false;
      if (!['message', 'like', 'mute', 'block', 'unhide', 'vote', 'report'].includes(b.action))
        return false;
      setData((previous) => {
        if (!previous) return previous;
        if (b.action === 'message') {
          const message = validateMessage(b);
          if (previous.messages.some((m) => m.id === b.clientId)) return previous;
          return {
            ...previous,
            messages: [
              ...previous.messages,
              {
                ...message,
                id: b.clientId ?? `preview-${Date.now()}`,
                userId: 'preview-self',
                name: b.name || 'You',
                avatar: b.avatar ?? null,
                at: new Date().toISOString(),
                playId: null,
                likes: 0,
                removed: false,
                resolvedGif: b.resolvedGif,
              },
            ],
          };
        }
        if (b.action === 'like') {
          const was = previous.liked.includes(b.id!);
          return {
            ...previous,
            liked: b.enabled
              ? [...new Set([...previous.liked, b.id!])]
              : previous.liked.filter((id) => id !== b.id),
            messages: previous.messages.map((m) =>
              m.id === b.id
                ? {
                    ...m,
                    likes: Math.max(
                      0,
                      m.likes + (was === Boolean(b.enabled) ? 0 : b.enabled ? 1 : -1),
                    ),
                  }
                : m,
            ),
          };
        }
        if (b.action === 'mute' || b.action === 'block')
          return { ...previous, hiddenUsers: [...new Set([...previous.hiddenUsers, b.userId!])] };
        if (b.action === 'unhide')
          return { ...previous, hiddenUsers: previous.hiddenUsers.filter((id) => id !== b.userId) };
        if (b.action === 'vote')
          return {
            ...previous,
            voted: { ...previous.voted, [b.id!]: b.choice! },
            polls: previous.polls.map((p) =>
              p.id === b.id
                ? { ...p, counts: p.counts.map((n, i) => n + (i === b.choice ? 1 : 0)) }
                : p,
            ),
          };
        return previous;
      });
      return true;
    };
    const load = async (_before?: string) => {};
    return {
      data,
      error: '',
      busy: false,
      act,
      load,
      simulator:
        enabled && gamePreview
          ? {
              step,
              next: () => setStep((n) => Math.min(9, n + 1)),
              previous: () => setStep((n) => Math.max(0, n - 1)),
              reset: () => setStep(0),
            }
          : null,
    };
  };
}
