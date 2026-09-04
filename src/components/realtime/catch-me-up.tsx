'use client';

import { useEffect, useState } from 'react';
import { Pause, Play, Sparkles } from 'lucide-react';

import type { CatchMeUpData } from '@/features/realtime/types';

export default function CatchMeUp({ data }: { data: CatchMeUpData }) {
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(false);
  useEffect(() => {
    setHeard(window.localStorage.getItem(`dd-catchup-${data.teamId}`) === 'heard');
  }, [data.teamId]);
  const toggle = () => {
    if (playing) {
      window.speechSynthesis?.cancel();
      setPlaying(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(data.script);
    utterance.rate = 1.05;
    utterance.onend = () => {
      setPlaying(false);
      setHeard(true);
      window.localStorage.setItem(`dd-catchup-${data.teamId}`, 'heard');
    };
    window.speechSynthesis?.speak(utterance);
    setPlaying(true);
  };
  return (
    <section className="team-primary-filled overflow-hidden rounded-3xl shadow-lg">
      <div className="grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-end sm:p-8">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[var(--team-on-primary)] opacity-80">
            <Sparkles className="h-4 w-4" /> {heard ? 'You’re caught up' : 'New since you left'}
          </p>
          <h2 className="mt-3 text-3xl font-black">
            {heard
              ? 'Nothing meaningful waiting.'
              : `${data.storyCount} things happened since ${data.since}`}
          </h2>
          <p className="mt-2 text-sm text-[var(--team-on-primary)] opacity-80">
            A no-filler team briefing built from meaningful updates only.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--secondary)] px-6 font-black text-[var(--team-on-secondary)]"
          aria-label={playing ? 'Pause Catch Me Up' : 'Play Catch Me Up'}
        >
          {playing ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}{' '}
          {playing
            ? 'Pause'
            : `Catch me up · ${Math.floor(data.durationSeconds / 60)}:${String(data.durationSeconds % 60).padStart(2, '0')}`}
        </button>
      </div>
    </section>
  );
}
