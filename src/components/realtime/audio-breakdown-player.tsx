'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Pause, Play, RotateCcw } from 'lucide-react';

import type { AudioDepth, StoryAudio } from '@/features/realtime/types';

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function AudioBreakdownPlayer({ audio }: { audio: StoryAudio[] }) {
  const [depth, setDepth] = useState<AudioDepth>('coach');
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState(false);
  const active = audio.find((item) => item.type === depth) ?? audio[0];

  useEffect(() => {
    setElapsed(0);
    setPlaying(false);
    window.speechSynthesis?.cancel();
  }, [depth]);
  useEffect(() => {
    if (!playing || !active) return;
    const timer = window.setInterval(
      () =>
        setElapsed((current) => {
          if (current >= active.durationSeconds - 1) {
            setPlaying(false);
            return active.durationSeconds;
          }
          return current + 1;
        }),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [active, playing]);
  if (!active) return null;

  const toggle = () => {
    if (playing) {
      window.speechSynthesis?.pause();
      setPlaying(false);
      return;
    }
    if (elapsed >= active.durationSeconds) setElapsed(0);
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      else {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(active.script);
        utterance.rate = 1.05;
        utterance.onend = () => {
          setPlaying(false);
          setElapsed(active.durationSeconds);
        };
        window.speechSynthesis.speak(utterance);
      }
    }
    setPlaying(true);
  };

  return (
    <section className="rounded-3xl bg-[var(--dark)] p-5 text-[var(--team-on-dark)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--team-secondary-on-dark)]">
            Audio rundown
          </p>
          <h3 className="mt-1 text-xl font-black">{active.label}</h3>
        </div>
        <select
          value={depth}
          onChange={(event) => setDepth(event.target.value as AudioDepth)}
          className="rounded-full border border-current/20 bg-white/10 px-3 py-2 text-xs font-bold text-[var(--team-on-dark)]"
          aria-label="Select explanation depth"
        >
          <option value="quick" className="text-slate-950">
            Just tell me
          </option>
          <option value="coach" className="text-slate-950">
            Coach, break it down
          </option>
          <option value="knowBall" className="text-slate-950">
            I know ball
          </option>
        </select>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--team-on-secondary)]"
          aria-label={playing ? 'Pause audio breakdown' : 'Play audio breakdown'}
        >
          {playing ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min="0"
            max={active.durationSeconds}
            value={elapsed}
            onChange={(event) => setElapsed(Number(event.target.value))}
            className="w-full accent-[var(--secondary)]"
            aria-label="Audio playback position"
          />
          <div className="mt-1 flex justify-between text-[10px] font-bold text-white/50">
            <span>{formatTime(elapsed)}</span>
            <span>{formatTime(active.durationSeconds)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            window.speechSynthesis?.cancel();
            setElapsed(0);
            setPlaying(false);
          }}
          className="text-white/60"
          aria-label="Restart audio"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setTranscript((value) => !value)}
        className="mt-4 flex items-center gap-1 text-xs font-bold text-white/65"
      >
        Transcript{' '}
        <ChevronDown className={`h-3.5 w-3.5 transition ${transcript ? 'rotate-180' : ''}`} />
      </button>
      {transcript ? (
        <p className="mt-3 border-t border-white/10 pt-4 text-sm leading-6 text-white/70">
          {active.script}
        </p>
      ) : null}
    </section>
  );
}
