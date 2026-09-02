'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2 } from 'lucide-react';

import { generateThreeAndOutAudioScript } from '@/features/three-and-out/audio';
import type { ThreeAndOutSnapshot } from '@/features/three-and-out/types';
import { useAuthUser } from '@/features/auth/auth-session';

const SPEEDS = [1, 1.25, 1.5, 2] as const;
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function ThreeAndOutAudioPlayer({ snapshot }: { snapshot: ThreeAndOutSnapshot }) {
  const script = useMemo(() => generateThreeAndOutAudioScript(snapshot), [snapshot]);
  const duration = snapshot.audioDuration ?? 90;
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastSavedAtRef = useRef(0);
  const { user } = useAuthUser();

  const saveProgress = (position: number, completed = false) => {
    if (!user) return;
    const now = Date.now();
    if (!completed && now - lastSavedAtRef.current < 10_000) return;
    lastSavedAtRef.current = now;
    void fetch('/api/user/content-state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contentType: 'AUDIO',
        contentId: snapshot.id,
        mediaVersion: snapshot.audioScriptVersion,
        progressSeconds: position,
        durationSeconds: duration,
        completed,
      }),
    });
  };

  const stopSpeech = () => {
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    setPlaying(false);
  };

  useEffect(() => {
    if (!user) return;
    void fetch(`/api/user/content-state?contentIds=${encodeURIComponent(snapshot.id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          body: {
            state?: Array<{ contentType: string; contentId: string; progressSeconds?: number }>;
          } | null,
        ) => {
          const saved = body?.state?.find(
            (item) => item.contentType === 'AUDIO' && item.contentId === snapshot.id,
          );
          if (saved?.progressSeconds) setElapsed(Math.min(saved.progressSeconds, duration));
        },
      );
  }, [duration, snapshot.id, user]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setElapsed((current) => {
          const next = Math.min(duration, current + speed);
          if (next >= duration) {
            setPlaying(false);
            saveProgress(duration, true);
          } else saveProgress(next);
          return next;
        }),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [duration, playing, saveProgress, speed]);

  const speakFrom = (position: number) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const words = script.split(/\s+/);
    const start = Math.floor((position / duration) * words.length);
    const utterance = new SpeechSynthesisUtterance(words.slice(start).join(' '));
    utterance.rate = speed;
    utterance.onend = () => {
      setElapsed(duration);
      setPlaying(false);
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  };

  const toggle = () => {
    if (playing) {
      window.speechSynthesis?.pause();
      setPlaying(false);
    } else if (window.speechSynthesis?.paused && utteranceRef.current) {
      window.speechSynthesis.resume();
      setPlaying(true);
    } else {
      speakFrom(elapsed >= duration ? 0 : elapsed);
      if (elapsed >= duration) setElapsed(0);
    }
  };

  return (
    <section
      className={`rounded-3xl bg-[#00172B] p-5 text-white shadow-lg sm:p-6 ${playing ? 'sticky bottom-3 z-30' : ''}`}
      aria-label="Three and Out audio player"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.23em] text-[var(--team-secondary-on-dark)]">
            <Volume2 className="h-4 w-4" /> Read Three and Out to me
          </p>
          <p className="mt-1 text-sm font-bold text-white/55">Listen · {formatTime(duration)}</p>
        </div>
        <div className="flex rounded-full bg-white/10 p-1" aria-label="Playback speed">
          {SPEEDS.map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => {
                const wasPlaying = playing;
                stopSpeech();
                setSpeed(value);
                if (wasPlaying) window.setTimeout(() => speakFrom(elapsed), 0);
              }}
              className={`min-h-9 rounded-full px-3 text-xs font-black ${speed === value ? 'bg-white text-[#00172B]' : 'text-white/60'}`}
              aria-pressed={speed === value}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--team-on-secondary)]"
          aria-label={playing ? 'Pause Three and Out' : 'Play Three and Out'}
        >
          {playing ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="ml-1 h-5 w-5 fill-current" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min="0"
            max={duration}
            value={Math.min(elapsed, duration)}
            onChange={(event) => {
              const next = Number(event.target.value);
              const wasPlaying = playing;
              stopSpeech();
              setElapsed(next);
              saveProgress(next);
              if (wasPlaying) window.setTimeout(() => speakFrom(next), 0);
            }}
            className="w-full accent-[var(--secondary)]"
            aria-label="Audio playback position"
          />
          <div className="mt-1 flex justify-between text-[10px] font-bold text-white/45">
            <span>{formatTime(elapsed)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            stopSpeech();
            setElapsed(0);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 hover:bg-white/10"
          aria-label="Restart Three and Out"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
