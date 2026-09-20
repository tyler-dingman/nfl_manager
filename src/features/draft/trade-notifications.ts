'use client';
import { create } from 'zustand';
import type { DraftSessionDTO } from '@/types/draft';
import { presentMockOffer } from '@/lib/mock-trade-presentation';

type State = {
  session: DraftSessionDTO | null;
  readIds: string[];
  receivedAt: Record<string, string>;
  drawerOpen: boolean;
  toastId: string | null;
  request: { offerId: string; sequence: number } | null;
  sync: (session: DraftSessionDTO) => string[];
  clear: (id: string) => void;
  markRead: (ids: string[]) => void;
  view: (offerId: string) => void;
};
const key = (id: string) => `draft-trade-read:${id}`;
export const useDraftTradeNotifications = create<State>((set, get) => ({
  session: null,
  readIds: [],
  receivedAt: {},
  drawerOpen: false,
  toastId: null,
  request: null,
  sync(session) {
    if (session.status !== 'in_progress' || session.mode !== 'mock') {
      get().clear(session.id);
      return [];
    }
    const previous = get();
    const same = previous.session?.id === session.id;
    let readIds = same ? previous.readIds : [];
    if (!same)
      try {
        const stored = JSON.parse(localStorage.getItem(key(session.id)) ?? '[]');
        if (Array.isArray(stored)) readIds = stored.filter((id) => typeof id === 'string');
      } catch {}
    const oldIds = new Set(
      same
        ? previous.session?.tradeState?.offers.map((o) => o.id)
        : session.tradeState?.offers.map((o) => o.id),
    );
    const fresh = (session.tradeState?.offers ?? [])
      .filter((o) => !oldIds.has(o.id) && presentMockOffer(session, o).valid)
      .map((o) => o.id);
    const resolved = (session.tradeState?.offers ?? [])
      .filter((o) => !presentMockOffer(session, o).valid)
      .map((o) => o.id);
    readIds = Array.from(new Set([...readIds, ...resolved]));
    const toastId =
      same &&
      previous.toastId &&
      session.tradeState?.offers.some(
        (o) => o.id === previous.toastId && presentMockOffer(session, o).valid,
      )
        ? previous.toastId
        : null;
    const receivedAt = {
      ...(same ? previous.receivedAt : {}),
      ...Object.fromEntries(fresh.map((id) => [id, new Date().toISOString()])),
    };
    set({
      session,
      readIds,
      receivedAt,
      toastId,
      ...(!same ? { drawerOpen: false, request: null } : {}),
    });
    try {
      localStorage.setItem(key(session.id), JSON.stringify(readIds));
    } catch {}
    return fresh;
  },
  clear(id) {
    if (get().session?.id === id)
      set({
        session: null,
        readIds: [],
        receivedAt: {},
        drawerOpen: false,
        toastId: null,
        request: null,
      });
  },
  markRead(ids) {
    const state = get();
    const readIds = Array.from(new Set([...state.readIds, ...ids]));
    set({ readIds });
    if (state.session)
      try {
        localStorage.setItem(key(state.session.id), JSON.stringify(readIds));
      } catch {}
  },
  view(offerId) {
    const state = get();
    const offer = state.session?.tradeState?.offers.find((o) => o.id === offerId);
    if (!offer || !state.session || !presentMockOffer(state.session, offer).valid) return;
    state.markRead([offerId]);
    set({
      drawerOpen: false,
      toastId: null,
      request: { offerId, sequence: (state.request?.sequence ?? 0) + 1 },
    });
  },
}));
export function unreadDraftOffers(state: Pick<State, 'session' | 'readIds'>) {
  return state.session
    ? (state.session.tradeState?.offers ?? []).filter(
        (o) => !state.readIds.includes(o.id) && presentMockOffer(state.session!, o).valid,
      ).length
    : 0;
}
