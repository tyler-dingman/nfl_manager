'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Play, SlidersHorizontal } from 'lucide-react';

import { FILM_ROOM_CATEGORIES } from '@/config/film-room';
import FilmRoomVideoModal from '@/components/film-room/film-room-video-modal';
import type { FilmRoomCategory, FilmRoomResponse, FilmRoomVideo } from '@/features/film-room/types';
import ShareToCrewButton from '@/components/crew/share-to-crew-button';

type Filter = 'all' | FilmRoomCategory;
type Sort = 'newest' | 'oldest' | 'most-viewed';

function formatCount(value: number | null) {
  if (value === null) return null;
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function relativeDate(value: string | null) {
  if (!value) return '';
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed)) return '';
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

function FilmRoomCard({
  video,
  sequence,
  onPlay,
}: {
  video: FilmRoomVideo;
  sequence: number;
  onPlay: (video: FilmRoomVideo, trigger: HTMLButtonElement) => void;
}) {
  const subscribers = formatCount(video.channel.subscriberCount);
  const published = relativeDate(video.publishedAt);

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="relative aspect-video overflow-hidden bg-slate-950">
        <button
          type="button"
          className="group absolute inset-0 block h-full w-full overflow-hidden text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          onClick={(event) => onPlay(video, event.currentTarget)}
          aria-label={`Play ${video.title}`}
        >
          {/* YouTube owns and serves this source thumbnail. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.thumbnail}
            alt=""
            loading={sequence > 3 ? 'lazy' : 'eager'}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          <span className="absolute inset-0 bg-black/5 transition group-hover:bg-black/15" />
          <span className="absolute left-0 top-0 bg-[var(--dark)] px-3 py-2 text-lg font-black text-[var(--team-on-dark)]">
            {String(sequence).padStart(2, '0')}
          </span>
          <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-black/50 text-white shadow-lg transition group-hover:scale-105 group-hover:bg-black/65">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
          {video.duration ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-xs font-black text-white">
              {video.duration}
            </span>
          ) : null}
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h2 className="line-clamp-2 text-lg font-black leading-tight text-[#00172b]">
          {video.title}
        </h2>
        <div className="mt-4 flex min-w-0 items-center gap-3">
          {video.channel.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.channel.avatar}
              alt=""
              loading="lazy"
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-black text-slate-500">
              {video.channel.name.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0 text-sm">
            <p className="truncate font-bold text-[#00172b]">{video.channel.name}</p>
            {subscribers || published ? (
              <p className="truncate text-slate-500">
                {subscribers ? `${subscribers} subscribers${published ? ' · ' : ''}` : ''}
                {published}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-auto grid grid-cols-3 border-t border-slate-200 pt-4 text-xs font-black uppercase tracking-wide text-[var(--team-primary-text)]">
          <a
            href={video.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 items-center gap-1.5 border-r border-slate-200 pr-3 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Watch on YouTube <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
          <ShareToCrewButton
            contentId={video.id}
            contentType="FILM_ROOM"
            href={`/film-room?video=${video.id}`}
            title={video.title}
            className="flex min-h-10 items-center justify-center px-2 text-center text-[10px] font-black"
          />
          <a
            href={video.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 items-center justify-end gap-1.5 pl-3 text-right hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            View Channel <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        </div>
      </div>
    </article>
  );
}

export default function FilmRoomGrid({
  teamAbbr,
  teamName,
}: {
  teamAbbr: string;
  teamName: string;
}) {
  const [data, setData] = useState<FilmRoomResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [selectedVideo, setSelectedVideo] = useState<FilmRoomVideo | null>(null);
  const [playTrigger, setPlayTrigger] = useState<HTMLButtonElement | null>(null);

  const openVideo = useCallback((video: FilmRoomVideo, trigger: HTMLButtonElement) => {
    setPlayTrigger(trigger);
    setSelectedVideo(video);
  }, []);

  const closeVideo = useCallback(() => setSelectedVideo(null), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    void fetch(`/api/film-room?team=${encodeURIComponent(teamAbbr)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as FilmRoomResponse;
        setData(payload);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setData({
            teamId: teamAbbr,
            videos: [],
            unavailableVideoIds: [],
            configured: true,
            message: 'Film Room is temporarily unavailable. Please try again soon.',
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      if (!controller.signal.aborted) controller.abort();
    };
  }, [teamAbbr]);

  const videos = useMemo(() => {
    const filtered = (data?.videos ?? []).filter(
      (video) => filter === 'all' || video.category === filter,
    );
    return [...filtered].sort((left, right) => {
      if (sort === 'most-viewed') return (right.viewCount ?? -1) - (left.viewCount ?? -1);
      const difference =
        new Date(right.publishedAt ?? right.addedAt).getTime() -
        new Date(left.publishedAt ?? left.addedAt).getTime();
      return sort === 'oldest' ? -difference : difference;
    });
  }, [data?.videos, filter, sort]);

  return (
    <section aria-label={`${teamName} Film Room videos`}>
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Video category">
          {FILM_ROOM_CATEGORIES.map((category) => {
            const selected = filter === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setFilter(category.id)}
                aria-pressed={selected}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  selected
                    ? 'bg-[var(--dark)] text-[var(--team-on-dark)]'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>
        <label className="flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="sr-only">Sort videos</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="bg-transparent font-bold outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="most-viewed">Most Viewed</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading videos">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className="aspect-video animate-pulse bg-slate-200" />
              <div className="space-y-3 p-5">
                <div className="h-5 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-9 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length ? (
        <div className="mt-5 grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video, index) => (
            <FilmRoomCard key={video.id} video={video} sequence={index + 1} onPlay={openVideo} />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-xl font-black text-[#00172b]">
            {filter === 'all' ? 'Film Room is warming up' : 'No videos in this category yet'}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-600">
            {filter === 'all'
              ? (data?.message ?? `Curated ${teamName} video coverage will appear here.`)
              : 'Try another category or select All to see every curated video.'}
          </p>
        </div>
      )}

      {data?.unavailableVideoIds.length ? (
        <p className="mt-4 text-center text-xs text-slate-500" role="status">
          {data.unavailableVideoIds.length} curated{' '}
          {data.unavailableVideoIds.length === 1 ? 'video is' : 'videos are'} currently unavailable.
        </p>
      ) : null}
      <p className="mt-8 text-center text-xs font-semibold text-slate-500">
        Down &amp; Distance curates videos from YouTube. All rights and ownership belong to the
        original creators.
      </p>
      {selectedVideo ? (
        <FilmRoomVideoModal
          video={selectedVideo}
          teamAbbr={teamAbbr}
          onClose={closeVideo}
          returnFocusTo={playTrigger}
        />
      ) : null}
    </section>
  );
}
