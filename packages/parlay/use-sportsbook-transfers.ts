import { useEffect, useRef, useState } from 'react';
import type { SlipLeg } from './slip';
import { validTransferUrl, type TransferRequest, type TransferState } from './fanduel-transfer';
import {
  isSportsbook,
  type Sportsbook,
  type TransferProposal,
  type SportsbookCompatibility,
} from './sportsbook-transfer';
const endpoint = '/api/parlay-lab/sportsbook-transfer';
type BookState = { busy: boolean; url?: string; error?: string };
export function useSportsbookTransfers(legs: SlipLeg[], request: TransferRequest) {
  const [books, setBooks] = useState<Sportsbook[]>([]),
    [discoveryLoading, setDiscoveryLoading] = useState(true),
    [discoveryError, setDiscoveryError] = useState(''),
    [compatibility, setCompatibility] = useState<SportsbookCompatibility[]>([]),
    [previewIdentity, setPreviewIdentity] = useState(''),
    [proposals, setProposals] = useState<TransferProposal[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [confirmation, setConfirmation] = useState<Sportsbook | null>(null),
    [states, setStates] = useState<Partial<Record<Sportsbook, BookState>>>({}),
    [revision, setRevision] = useState(0),
    [settled, setSettled] = useState(0),
    [waitingBook, setWaitingBook] = useState<Sportsbook | null>(null);
  const navigation = useRef<{ book: Sportsbook; open: (url: string) => void } | null>(null);
  const generateRef = useRef<(p: TransferProposal, approved: boolean) => Promise<void>>(
    async () => {},
  );
  const active = useRef<AbortController | null>(null),
    epoch = useRef({ value: 0 }),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const identity = JSON.stringify(
    legs.map((l) => [l.id, l.line, l.side, l.sportsbook, l.available]),
  );
  const latestIdentity = useRef(identity);
  latestIdentity.current = identity;
  const queued = useRef<{ p: TransferProposal; approved: boolean; identity: string } | null>(null);
  const bookKey = books.join(',');
  const previewKey = JSON.stringify([identity, bookKey, revision]);
  const patch = (book: Sportsbook, value: BookState) => setStates((s) => ({ ...s, [book]: value }));
  useEffect(() => {
    const c = new AbortController();
    setDiscoveryLoading(true);
    setDiscoveryError('');
    void request(endpoint, { signal: c.signal })
      .then(async (r) => {
        if (!r.ok) throw Error('Unable to check sportsbook transfers. Please try again.');
        const body = await r.json();
        if (!Array.isArray(body.books))
          throw Error('Unable to check sportsbook transfers. Please try again.');
        return body;
      })
      .then((b) => {
        if (!c.signal.aborted) {
          setBooks((b.books ?? []).filter(isSportsbook));
          if (b.error) setDiscoveryError(b.error);
        }
      })
      .catch(() => {
        if (!c.signal.aborted)
          setDiscoveryError(
            'Unable to check sportsbook transfers. Check your connection or content blocker, then try again.',
          );
      })
      .finally(() => {
        if (!c.signal.aborted) setDiscoveryLoading(false);
      });
    return () => c.abort();
  }, [request, revision, identity]);
  useEffect(() => {
    const lifecycle = epoch.current;
    lifecycle.value++;
    // Finish polling an already-submitted job so it can release the shared active-job slot.
    // Its epoch is now stale: it cannot publish a URL or navigate after the slip changes.
    navigation.current = null;
    queued.current = null;
    setWaitingBook(null);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStates({});
    setProposals([]);
    setCompatibility([]);
    setPreviewIdentity('');
    setConfirmation(null);
    setError('');
    const c = new AbortController();
    const ids = JSON.parse(identity).map((l: unknown[]) => l[0]);
    setLoading(!!bookKey && !!ids.length);
    const timer = setTimeout(() => {
      if (!bookKey || !ids.length) return;
      void request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', ids }),
        signal: c.signal,
      })
        .then(async (r) => {
          const b = await r.json();
          if (!r.ok) throw Error(b.error || 'Unable to check sportsbook availability.');
          return b;
        })
        .then((b) => {
          if (!c.signal.aborted) {
            setProposals(
              (b.proposals ?? []).filter((p: TransferProposal) =>
                bookKey.split(',').includes(p.sportsbook),
              ),
            );
            setCompatibility(b.compatibility ?? []);
            setPreviewIdentity(previewKey);
          }
        })
        .catch((e) => {
          if (!c.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      c.abort();
      lifecycle.value++;
      navigation.current = null;
      timers.current.forEach(clearTimeout);
    };
  }, [identity, bookKey, revision, request, previewKey]);
  useEffect(
    () => () => {
      active.current?.abort();
      navigation.current = null;
    },
    [],
  );
  async function generate(p: TransferProposal, approved: boolean) {
    if (active.current || !bookKey.split(',').includes(p.sportsbook)) return;
    const book = p.sportsbook,
      c = new AbortController(),
      run = ++epoch.current.value;
    active.current = c;
    setConfirmation(null);
    patch(book, { busy: true });
    const call = async (body: object): Promise<TransferState> => {
      const r = await request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: c.signal,
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || 'Unable to prepare this sportsbook slip.');
      if (b.url && !validTransferUrl(b.url, book))
        throw Error('The sportsbook returned an invalid link. Your parlay has been preserved.');
      return b;
    };
    const wait = () =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          c.signal.removeEventListener('abort', abort);
          resolve();
        };
        const t = setTimeout(done, 2000);
        const abort = () => {
          clearTimeout(t);
          reject(Error('Cancelled'));
        };
        c.signal.addEventListener('abort', abort, { once: true });
      });
    try {
      let state = await call({ action: 'start', sportsbook: book, token: p.token, approved });
      for (let i = 0; i < 45 && ['submitting', 'pending'].includes(state.status); i++) {
        if (c.signal.aborted) return;
        await wait();
        if (c.signal.aborted) return;
        state = await call({ action: 'poll', sportsbook: book, id: state.id });
      }
      if (run !== epoch.current.value || identity !== latestIdentity.current) return;
      if (state.status !== 'complete' || !state.url)
        throw Error(state.error || 'Preparation timed out. Your parlay has been preserved.');
      const remaining = Date.parse(state.expiresAt ?? '') - Date.now();
      if (!(remaining > 0))
        throw Error('This link expired. Availability will update automatically.');
      patch(book, { busy: false, url: state.url });
      const intent = navigation.current;
      if (intent?.book === book) {
        navigation.current = null;
        setWaitingBook(null);
        intent.open(state.url);
      }
      timers.current.push(
        setTimeout(
          () =>
            patch(book, {
              busy: false,
              error: 'This link expired. Availability will update automatically.',
            }),
          remaining,
        ),
      );
    } catch (e) {
      if (run === epoch.current.value && identity === latestIdentity.current && !c.signal.aborted) {
        navigation.current = null;
        setWaitingBook(null);
        patch(book, { busy: false, error: (e as Error).message });
      }
    } finally {
      if (active.current === c) {
        active.current = null;
        setSettled((n) => n + 1);
      }
    }
  }
  generateRef.current = generate;
  useEffect(() => {
    const q = queued.current;
    if (!q || active.current || q.identity !== latestIdentity.current) return;
    queued.current = null;
    void generateRef.current(q.p, q.approved);
  }, [settled]);
  // Reconcile stored offers/flags automatically. Never generate from this timer.
  // Keep an active confirmation, generation, or usable link intact.
  useEffect(() => {
    if (
      !legs.length ||
      discoveryLoading ||
      loading ||
      confirmation ||
      Object.values(states).some((state) => state?.busy || state?.url)
    )
      return;
    const timer = setTimeout(
      () => {
        if (!active.current) setRevision((n) => n + 1);
      },
      discoveryError || error ? 5000 : 30000,
    );
    return () => clearTimeout(timer);
  }, [
    legs.length,
    discoveryLoading,
    loading,
    confirmation,
    states,
    discoveryError,
    error,
    revision,
  ]);

  function choose(book: Sportsbook, open?: (url: string) => void) {
    const p = proposals.find((p) => p.sportsbook === book);
    if (!p || previewIdentity !== previewKey) return;
    if (states[book]?.url) {
      open?.(states[book]!.url!);
      return;
    }
    if (open) {
      navigation.current = { book, open };
      setWaitingBook(book);
    }
    if (Date.parse(p.expiresAt) <= Date.now()) {
      navigation.current = null;
      setWaitingBook(null);
      setRevision((n) => n + 1);
      return;
    }
    if (p.adjustments) setConfirmation(book);
    else if (active.current) {
      if (!states[book]?.busy) {
        queued.current = { p, approved: false, identity };
        patch(book, { busy: true });
      }
    } else void generate(p, false);
  }
  function confirm() {
    if (previewIdentity !== previewKey) return;
    const p = proposals.find((p) => p.sportsbook === confirmation);
    if (p) {
      if (active.current) {
        queued.current = { p, approved: true, identity };
        setConfirmation(null);
        patch(p.sportsbook, { busy: true });
      } else void generate(p, true);
    }
  }
  function cancel(book: Sportsbook) {
    queued.current = null;
    navigation.current = null;
    setWaitingBook(null);
    epoch.current.value++;
    active.current?.abort();
    active.current = null;
    patch(book, { busy: false });
  }
  return {
    enabled: books.length > 0,
    proposals: previewIdentity === previewKey ? proposals : [],
    compatibility,
    unavailableReason: compatibility.some((c) => c.enabled && c.reason?.startsWith('Same-game'))
      ? 'This slip includes multiple props from the same game. Same-game sportsbook transfers are not supported yet. Remove one of those legs to see eligible sportsbook buttons; your parlay can still be saved or shared.'
      : 'Stored odds do not support a complete slip at an enabled sportsbook with verified market support. You can still save or share your parlay.',
    unavailable:
      !!bookKey &&
      !!legs.length &&
      previewIdentity === previewKey &&
      !loading &&
      !error &&
      !proposals.length,
    loading: discoveryLoading || loading,
    error: discoveryError || error,
    states: previewIdentity === previewKey ? states : {},
    confirmation: previewIdentity === previewKey ? confirmation : null,
    choose,
    confirm,
    waitingBook,
    cancelConfirmation: () => {
      setConfirmation(null);
      navigation.current = null;
      setWaitingBook(null);
    },
    cancel,
    busy: Object.values(states).some((s) => s?.busy),
  };
}
export type SportsbookTransferModel = ReturnType<typeof useSportsbookTransfers>;
