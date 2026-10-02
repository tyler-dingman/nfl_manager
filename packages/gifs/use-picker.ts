import type { GifItem, GifProvider } from './index';
import type { Hooks } from '../huddle/use-huddle';
export function createUseGifPicker({ useState, useRef, useEffect }: Hooks) {
  return function useGifPicker(provider: GifProvider) {
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<GifItem[]>([]);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [retry, setRetry] = useState(0);
    const generation = useRef(0),
      pending = useRef<AbortController | null>(null);
    const fetchPage = async (next?: string) => {
      const gen = ++generation.current;
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      setBusy(true);
      setError('');
      try {
        const result = query.trim()
          ? await provider.search(query.trim(), next, controller.signal)
          : await provider.trending(next, controller.signal);
        if (gen !== generation.current) return;
        setItems((old) => (next ? [...old, ...result.items] : result.items));
        setCursor(result.cursor);
      } catch (e) {
        if (gen === generation.current && !controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Couldn't load GIFs. Try again.");
      } finally {
        if (gen === generation.current) setBusy(false);
      }
    };
    useEffect(() => {
      ++generation.current;
      pending.current?.abort();
      setItems([]);
      setCursor(undefined);
      setBusy(true);
      setError('');
      const timer = setTimeout(() => void fetchPage(), query.trim() ? 300 : 0);
      return () => {
        clearTimeout(timer);
        ++generation.current;
        pending.current?.abort();
      };
    }, [query, provider, retry]);
    return {
      query,
      setQuery,
      items,
      cursor,
      error,
      busy,
      retry: () => setRetry((n) => n + 1),
      more: () => {
        if (!busy && cursor) void fetchPage(cursor);
      },
    };
  };
}
