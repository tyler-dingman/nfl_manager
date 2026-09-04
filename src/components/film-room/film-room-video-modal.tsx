'use client';

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';

import type { FilmRoomVideo } from '@/features/film-room/types';
import { getReadableTextColor } from '@/lib/color-utils';
import { getTeamThemeTokens } from '@/lib/team-theme-tokens';
import { getTeamBrandTheme } from '@/lib/team-brand-themes';

type FilmRoomVideoModalProps = {
  video: FilmRoomVideo;
  teamAbbr: string;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
};

function formatCount(value: number | null) {
  if (value === null) return null;
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function relativeDate(value: string | null) {
  if (!value) return null;
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed)) return null;
  const future = elapsed < 0;
  const absolute = Math.abs(elapsed);
  const units = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ] as const;
  const [unit, milliseconds] = units.find(([, size]) => absolute >= size) ?? ['minute', 60_000];
  const amount = Math.max(1, Math.floor(absolute / milliseconds));
  return new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }).format(
    future ? amount : -amount,
    unit,
  );
}

export default function FilmRoomVideoModal({
  video,
  teamAbbr,
  onClose,
  returnFocusTo,
}: FilmRoomVideoModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
      returnFocusTo?.focus({ preventScroll: true });
    };
  }, [onClose, returnFocusTo]);

  const subscribers = formatCount(video.channel.subscriberCount);
  const views = formatCount(video.viewCount);
  const published = relativeDate(video.publishedAt);
  const describedBy = video.description || published || views ? descriptionId : undefined;
  const theme = getTeamBrandTheme(teamAbbr);
  const themeTokens = getTeamThemeTokens(teamAbbr);
  const portalTheme = {
    '--primary': themeTokens.primaryFill,
    '--dark': theme.dark,
    '--team-primary-fill': themeTokens.primaryFill,
    '--team-primary-foreground': themeTokens.onPrimary,
    '--team-on-primary': themeTokens.onPrimary,
    '--color-on-primary': themeTokens.onPrimary,
    '--team-on-dark': getReadableTextColor(theme.dark),
  } as CSSProperties;

  return createPortal(
    <div
      style={portalTheme}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-0 backdrop-blur-[2px] sm:p-4 lg:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className="relative flex max-h-[100dvh] w-full max-w-[1480px] flex-col overflow-y-auto border border-white/15 bg-[#151616] text-white shadow-[0_28px_100px_rgba(0,0,0,0.7)] sm:max-h-[94dvh] sm:w-[min(94vw,calc((94dvh-23rem)*16/9+2.5rem))] sm:rounded-2xl lg:w-[min(88vw,calc((94dvh-23rem)*16/9+5rem))]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close video player"
          className="absolute right-3 top-3 z-10 grid h-12 w-12 place-items-center rounded-full bg-[var(--dark)] text-[var(--team-on-dark)] shadow-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-4 sm:top-4"
        >
          <X className="h-7 w-7" aria-hidden="true" />
        </button>

        <div className="p-0 sm:p-5 lg:p-10 lg:pb-5">
          <div className="aspect-video w-full overflow-hidden bg-black sm:mx-auto sm:max-w-[min(100%,calc((94dvh-23rem)*16/9))] sm:rounded-lg">
            <iframe
              className="h-full w-full"
              src={video.embedUrl}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>

        <div className="px-5 pb-6 pt-5 sm:px-7 lg:px-10 lg:pb-8">
          <h2 id={titleId} className="max-w-5xl text-2xl font-black leading-tight sm:text-3xl">
            {video.title}
          </h2>

          <div className="mt-5 flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {video.channel.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.channel.avatar}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-lg font-black">
                  {video.channel.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{video.channel.name}</p>
                {subscribers ? (
                  <p className="text-sm text-white/65">{subscribers} subscribers</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={video.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="team-primary-filled-hover flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--primary)] px-5 text-sm font-black uppercase tracking-wide text-[var(--primary)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                View Channel <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={video.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="team-primary-filled flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-black uppercase tracking-wide transition brightness-100 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Watch on YouTube <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          {published || views || video.description ? (
            <div id={descriptionId} className="pt-4 text-sm leading-6 text-white/75 sm:text-base">
              {published || views ? (
                <p className="font-medium text-white/85">
                  {published}
                  {published && views ? <span className="px-3 text-white/40">•</span> : null}
                  {views ? `${views} views` : null}
                </p>
              ) : null}
              {video.description ? (
                <p className="mt-3 max-w-5xl whitespace-pre-line line-clamp-3">
                  {video.description}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
