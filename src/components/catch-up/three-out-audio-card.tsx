'use client';

import { Check, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { CatchUpResponse } from '@/features/catch-up/types';
import {
  buildThreeOutNarration,
  nextThreeOutPlayback,
  type ThreeOutPlayback,
} from '@/features/three-and-out/catch-up-audio';
import {
  BrowserSpeechThreeOutProvider,
  CachedAudioThreeOutProvider,
  type ThreeOutTtsProvider,
} from '@/features/three-and-out/tts-provider';

export default function ThreeOutAudioCard({ data }: { data: CatchUpResponse }) {
  const narration = useMemo(
    () => buildThreeOutNarration(data.teamId, data.teamName, data.items),
    [data.currentSnapshotId, data.items, data.teamId, data.teamName],
  );
  const [audioSegments, setAudioSegments] = useState<Array<{
    audioUrl: string;
    sectionStartTimes?: number[];
  }> | null>(null);
  const recordedPoc = audioSegments?.length === 1;
  const [building, setBuilding] = useState(true);
  const provider = useMemo<ThreeOutTtsProvider>(
    () =>
      audioSegments?.length
        ? new CachedAudioThreeOutProvider()
        : new BrowserSpeechThreeOutProvider(),
    [audioSegments],
  );
  const [playback, setPlayback] = useState<ThreeOutPlayback>({ status: 'IDLE', activeIndex: 0 });

  useEffect(() => {
    if (!narration) {
      setBuilding(false);
      return;
    }
    const controller = new AbortController();
    setBuilding(true);
    void fetch('/api/three-and-out/audio', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        teamId: narration.teamId,
        storyIds: narration.segments.map((segment) => segment.storyId),
      }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          body: {
            provider?: string;
            segments?: Array<{ audioUrl: string; sectionStartTimes?: number[] }>;
          } | null,
        ) => {
          if (
            (body?.provider === 'chatterbox' && body.segments?.length === 3) ||
            (body?.provider === 'recorded-poc' && body.segments?.length === 1)
          )
            setAudioSegments(body.segments);
          else setAudioSegments(null);
        },
      )
      .catch(() => setAudioSegments(null))
      .finally(() => {
        if (!controller.signal.aborted) setBuilding(false);
      });
    return () => controller.abort();
  }, [narration]);

  const speak = (index: 0 | 1 | 2) => {
    if (!narration || !provider.available) {
      setPlayback({ status: 'ERROR', activeIndex: null });
      return;
    }
    setPlayback({ status: 'PLAYING', activeIndex: index });
    provider.speak(
      {
        text: narration.segments[index].script,
        audioUrl: recordedPoc ? audioSegments?.[0]?.audioUrl : audioSegments?.[index]?.audioUrl,
        sectionStartTimes: recordedPoc ? audioSegments?.[0]?.sectionStartTimes : undefined,
      },
      {
        onEnd: () => {
          if (recordedPoc) {
            setPlayback({ status: 'COMPLETE', activeIndex: null });
            return;
          }
          const next = nextThreeOutPlayback(index);
          setPlayback(next);
          if (next.status === 'PLAYING') speak(next.activeIndex);
        },
        onError: () => setPlayback({ status: 'ERROR', activeIndex: null }),
        onProgressIndex: recordedPoc
          ? (activeIndex) =>
              setPlayback((current) => ({
                status: current.status === 'PAUSED' ? 'PAUSED' : 'PLAYING',
                activeIndex,
              }))
          : undefined,
      },
    );
  };

  useEffect(() => () => provider.cancel(), [provider]);
  if (!narration) return null;

  const toggle = () => {
    if (playback.status === 'PLAYING') {
      provider.pause();
      setPlayback({ status: 'PAUSED', activeIndex: playback.activeIndex });
    } else if (playback.status === 'PAUSED') {
      provider.resume();
      setPlayback({ status: 'PLAYING', activeIndex: playback.activeIndex });
    } else {
      provider.cancel();
      speak(0);
    }
  };
  const complete = playback.status === 'COMPLETE';
  const label =
    playback.status === 'PLAYING'
      ? 'Pause Three & Out'
      : playback.status === 'PAUSED'
        ? 'Resume Three & Out'
        : complete
          ? 'Play Three & Out again'
          : 'Play Three & Out';

  return (
    <section
      className="mt-8 overflow-hidden rounded-3xl border border-[#00172B]/10 bg-white shadow-lg"
      aria-label="Three and Out audio catch-up"
    >
      <header className="relative overflow-hidden bg-[#00172B] px-6 py-7 text-white sm:px-9 sm:py-8">
        <div
          aria-hidden="true"
          className="absolute -right-8 -top-12 h-48 w-48 rounded-full border-[18px] border-white/[.035]"
        />
        <h2 className="relative text-4xl font-black italic tracking-[-.05em] sm:text-5xl">
          THREE <span className="text-[var(--primary)]">&amp;</span> OUT
        </h2>
        <p className="relative mt-2 text-xs font-black uppercase tracking-[.2em] text-[var(--team-secondary-on-dark)]">
          The 3 things you need to know
        </p>
      </header>
      <div className="p-5 sm:p-8">
        <ol className="space-y-2">
          {narration.segments.map((segment, index) => {
            const active = playback.activeIndex === index;
            return (
              <li
                key={segment.storyId}
                className={`grid grid-cols-[3.25rem_1fr] items-center gap-4 rounded-2xl px-2 py-3 transition sm:grid-cols-[3.75rem_1fr] ${active ? 'bg-[var(--primary)]/[.055]' : ''}`}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={`grid h-12 w-12 place-items-center rounded-full text-base font-black sm:h-14 sm:w-14 ${
                    complete
                      ? 'bg-[#00172B] text-white'
                      : active
                        ? 'team-primary-filled'
                        : 'bg-slate-200 text-[#00172B]'
                  }`}
                >
                  {complete ? <Check className="h-5 w-5" /> : String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="flex items-center gap-2 text-base font-black sm:text-lg">
                    {segment.label}
                    {active && playback.status !== 'IDLE' ? (
                      <span className="text-[9px] uppercase tracking-[.18em] text-[var(--team-primary-text)]">
                        {playback.status === 'PAUSED' ? 'Paused' : 'Now'}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm leading-5 text-slate-600 sm:text-base">
                    {segment.headline}
                  </span>
                  <span className="sr-only">
                    {active ? `Story ${index + 1} of 3 currently playing` : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={toggle}
          disabled={playback.status === 'ERROR' || building}
          className="team-primary-filled mt-5 flex min-h-14 w-full items-center justify-between rounded-2xl px-5 text-sm font-black uppercase tracking-[.06em] disabled:cursor-not-allowed disabled:opacity-55 sm:px-7 sm:text-base"
          aria-label={label}
        >
          <span className="flex items-center gap-3">
            {playback.status === 'PLAYING' ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : complete ? (
              <RotateCcw className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
            {building
              ? 'Building your Three & Out…'
              : playback.status === 'ERROR'
                ? 'Audio temporarily unavailable'
                : label}
          </span>
          <span className="text-xs opacity-80">~{narration.estimatedSeconds} sec</span>
        </button>
      </div>
    </section>
  );
}
