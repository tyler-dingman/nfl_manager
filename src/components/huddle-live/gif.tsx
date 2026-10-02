'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import { createKlipyProvider } from '../../../packages/gifs/klipy';
import { GIF_CHIPS, type GifItem, type GifReference } from '../../../packages/gifs';
import { createUseGifPicker } from '../../../packages/gifs/use-picker';
import s from './gif.module.css';
export const gifProvider = createKlipyProvider(process.env.NEXT_PUBLIC_KLIPY_APP_KEY);
const usePicker = createUseGifPicker({ useCallback, useEffect, useRef, useState });
export function gifEvent(name: 'picker_opened' | 'search' | 'selected' | 'sent') {
  window.dispatchEvent(
    new CustomEvent('down-distance:analytics', { detail: { event: `huddle_gif_${name}` } }),
  );
}
export function GifPicker({
  onSelect,
  onClose,
}: {
  onSelect: (gif: GifItem, query: string) => void;
  onClose: () => void;
}) {
  const p = usePicker(gifProvider),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    d?.querySelector('input')?.focus();
    gifEvent('picker_opened');
    return () => d?.close();
  }, []);
  useEffect(() => {
    if (!p.query) return;
    const t = setTimeout(() => gifEvent('search'), 300);
    return () => clearTimeout(t);
  }, [p.query]);
  return (
    <dialog
      ref={dialog}
      className={s.picker}
      aria-label="KLIPY GIF picker"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className={s.content}>
        <header>
          <b>KLIPY</b>
          <span>GIFs for every moment.</span>
          <a href="https://klipy.com" target="_blank" rel="noreferrer">
            Powered by KLIPY ↗
          </a>
          <button type="button" aria-label="Close GIF picker" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <label className={s.search}>
          <Search size={22} />
          <input
            autoFocus
            aria-label="Search GIFs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholder="Search KLIPY"
            maxLength={120}
            value={p.query}
            onChange={(e) => p.setQuery(e.target.value)}
          />
          {p.query && (
            <button type="button" aria-label="Clear GIF search" onClick={() => p.setQuery('')}>
              <X size={18} />
            </button>
          )}
        </label>
        <div className={s.chips}>
          {GIF_CHIPS.map(([label, q]) => (
            <button
              type="button"
              key={label}
              aria-pressed={p.query === q}
              onClick={() => p.setQuery(q)}
            >
              {label}
            </button>
          ))}
        </div>
        <div aria-live="polite">
          {p.error && (
            <div className={s.state}>
              {p.error}
              <button type="button" onClick={p.retry}>
                Try again
              </button>
            </div>
          )}
          {p.busy && <p>Loading GIFs…</p>}
          {!p.busy && !p.error && !p.items.length && (
            <p>No GIFs found{p.query ? ` for “${p.query}”` : ''}.</p>
          )}
        </div>
        <div className={s.grid}>
          {p.items.map((gif, i) => (
            <button
              type="button"
              key={`${gif.id}-${i}`}
              aria-label={`Select ${gif.title}`}
              onClick={() => {
                gifEvent('selected');
                onSelect(gif, p.query);
              }}
            >
              <GifImage gif={gif} preview />
              <small>{gif.attribution}</small>
            </button>
          ))}
        </div>
        {p.cursor && (
          <button type="button" className={s.more} disabled={p.busy} onClick={p.more}>
            Load more GIFs
          </button>
        )}
      </div>
    </dialog>
  );
}
export function GifImage({ gif, preview = false }: { gif: GifItem; preview?: boolean }) {
  const root = useRef<HTMLDivElement>(null),
    [visible, setVisible] = useState(false),
    [reduced, setReduced] = useState(true),
    [play, setPlay] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(mq.matches);
    change();
    mq.addEventListener('change', change);
    const observer = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (root.current) observer.observe(root.current);
    return () => {
      mq.removeEventListener('change', change);
      observer.disconnect();
    };
  }, []);
  const animate = visible && (!reduced || play);
  return (
    <div ref={root} className={s.media} style={{ aspectRatio: gif.aspectRatio }}>
      {failed ? (
        <span>GIF unavailable</span>
      ) : (
        <img
          loading="lazy"
          src={animate ? (preview ? gif.previewUrl : gif.mediaUrl) : gif.stillUrl}
          alt={gif.title || 'GIF'}
          onError={() => setFailed(true)}
        />
      )}
      {!preview && reduced && !failed && (
        <button type="button" onClick={() => setPlay(!play)}>
          {play ? 'Pause GIF' : 'Play GIF'}
        </button>
      )}
    </div>
  );
}
export function PostedGif({ media, resolved }: { media: GifReference; resolved?: GifItem }) {
  const [gif, setGif] = useState<GifItem | undefined>(resolved),
    [error, setError] = useState(false);
  useEffect(() => {
    if (resolved) {
      setGif(resolved);
      return;
    }
    const c = new AbortController();
    gifProvider
      .getById(media.providerMediaId, c.signal)
      .then((g) => {
        if (!c.signal.aborted) {
          setGif(g ?? undefined);
          setError(!g);
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => c.abort();
  }, [media.providerMediaId, resolved]);
  return (
    <div className={s.posted}>
      {gif ? (
        <>
          <GifImage gif={gif} />
          <a href={gif.providerUrl} target="_blank" rel="noreferrer">
            {gif.attribution}
          </a>
        </>
      ) : (
        <span>{error ? 'GIF unavailable' : 'Loading GIF…'}</span>
      )}
    </div>
  );
}
