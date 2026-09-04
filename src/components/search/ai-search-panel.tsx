'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  CirclePlus,
  ExternalLink,
  Mic,
  Newspaper,
  Search,
  Sparkles,
  UserRound,
  Video,
} from 'lucide-react';

import type { SearchResponse } from '@/features/search/types';
import { lightenHexColor } from '@/lib/color-utils';

type Props = {
  teamId: string;
  teamName: string;
  teamCity: string;
  primaryColor: string;
  nickname: string;
  query: string;
  onQueryChange: (query: string) => void;
};

const iconSuggestions = [Newspaper, Mic, Video, CirclePlus, UserRound] as const;

export default function AiSearchPanel({
  teamId,
  teamName,
  teamCity,
  primaryColor,
  nickname,
  query,
  onQueryChange,
}: Props) {
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
  const [animationStopped, setAnimationStopped] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'listening' | 'transcribing' | 'searching' | 'error'
  >('idle');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const nicknamePhrase = teamId === 'KC' ? 'Mahomes' : `the ${nickname}`;
  const suggestions = [
    'Catch me up today',
    `What did ${nicknamePhrase} say?`,
    'Best film this week',
    'Injury updates',
    'Rookie impact',
  ];
  const placeholders = [
    `When do the ${nickname} play next?`,
    'What is the over/under?',
    teamId === 'KC' ? 'What did Andy Reid say today?' : `What did the ${nickname} say today?`,
    'Ask anything...',
  ];
  const lighterPrimary = useMemo(() => lightenHexColor(primaryColor, 0.2), [primaryColor]);

  useEffect(() => {
    if (animationStopped) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAnimatedPlaceholder('Ask anything...');
      return;
    }
    let cancelled = false;
    let timer: number;
    const wait = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, milliseconds);
      });
    const animate = async () => {
      for (let phraseIndex = 0; phraseIndex < placeholders.length && !cancelled; phraseIndex += 1) {
        const phrase = placeholders[phraseIndex];
        for (let length = 1; length <= phrase.length && !cancelled; length += 1) {
          setAnimatedPlaceholder(phrase.slice(0, length));
          await wait(48 + Math.random() * 35);
        }
        if (phraseIndex === placeholders.length - 1) return;
        await wait(4000);
        for (let length = phrase.length - 1; length >= 0 && !cancelled; length -= 1) {
          setAnimatedPlaceholder(phrase.slice(0, length));
          await wait(24);
        }
        await wait(250);
      }
    };
    void animate();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // The sequence intentionally starts once and stops forever after interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationStopped]);

  useEffect(
    () => () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const stopAnimation = () => setAnimationStopped(true);

  const runSearch = async (searchQuery: string) => {
    const normalized = searchQuery.trim();
    if (normalized.length < 2) return;
    stopAnimation();
    onQueryChange(normalized);
    setStatus('searching');
    setError('');
    try {
      const result = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: normalized, teamId, limit: 12 }),
      });
      const payload = (await result.json()) as SearchResponse & { error?: string };
      if (!result.ok) throw new Error(payload.error ?? 'Search failed');
      setResponse(payload);
      setStatus('idle');
    } catch (searchError) {
      setStatus('error');
      setError(searchError instanceof Error ? searchError.message : 'Search is unavailable.');
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void runSearch(query);
  };

  const stopRecording = () =>
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();

  const voiceSearch = async () => {
    stopAnimation();
    if (status === 'listening') {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('error');
      setError('Voice search is not supported by this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!audio.size) {
          setStatus('error');
          setError('No speech was detected.');
          return;
        }
        setStatus('transcribing');
        const form = new FormData();
        form.set('audio', audio, 'voice-search.webm');
        try {
          const result = await fetch('/api/search/transcribe', { method: 'POST', body: form });
          const payload = (await result.json()) as { text?: string; error?: string };
          if (!result.ok || !payload.text) throw new Error(payload.error ?? 'Transcription failed');
          onQueryChange(payload.text);
          await runSearch(payload.text);
        } catch (voiceError) {
          setStatus('error');
          setError(voiceError instanceof Error ? voiceError.message : 'Voice search failed.');
        }
      };
      recorder.start();
      setStatus('listening');
      setError('');
      stopTimerRef.current = window.setTimeout(stopRecording, 20_000);
    } catch {
      setStatus('error');
      setError('Microphone access was denied or unavailable.');
    }
  };

  return (
    <div>
      <section
        aria-labelledby="ai-search-heading"
        className="relative overflow-hidden rounded-2xl px-5 py-8 shadow-[0_18px_45px_rgba(15,23,42,0.18)] sm:px-10 sm:py-10 lg:px-16 lg:py-14"
        style={{
          background: `linear-gradient(110deg, ${primaryColor} 0%, ${lighterPrimary} 100%)`,
        }}
      >
        <PlaybookDecoration />
        <div className="relative z-[1]">
          <h2
            id="ai-search-heading"
            className="text-2xl font-black tracking-tight text-white sm:text-3xl"
          >
            Ask anything about <span className="text-[var(--secondary)]">{teamCity} football</span>
          </h2>
          <form onSubmit={submit} role="search" className="mt-6">
            <div className="flex h-16 items-center rounded-full bg-white px-3 shadow-lg sm:h-20 sm:px-5">
              <span className="relative mr-3 grid h-9 w-10 shrink-0 place-items-center border-r border-slate-200 pr-3 sm:mr-5 sm:h-12 sm:w-14 sm:pr-5">
                <Sparkles className="h-7 w-7 text-[var(--primary)]" aria-hidden="true" />
              </span>
              <label htmlFor="ask-dd" className="sr-only">
                Search Down &amp; Distance
              </label>
              <input
                id="ask-dd"
                type="search"
                value={query}
                onFocus={stopAnimation}
                onPointerDown={stopAnimation}
                onChange={(event) => {
                  stopAnimation();
                  onQueryChange(event.target.value);
                }}
                placeholder={animatedPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-base font-bold text-[#00172b] outline-none placeholder:text-[#66788c] sm:text-xl"
              />
              <button
                type="button"
                onClick={() => void voiceSearch()}
                aria-label="Search by voice"
                aria-pressed={status === 'listening'}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition sm:h-12 sm:w-12 ${status === 'listening' ? 'team-primary-filled animate-pulse' : 'text-[#00172b] hover:bg-slate-100'}`}
              >
                <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              <button
                type="submit"
                aria-label="Search"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#00172b] transition hover:bg-slate-100 sm:h-12 sm:w-12"
              >
                <Search className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            </div>
          </form>
          <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-1 sm:flex-wrap">
            <span className="shrink-0 text-lg font-black text-white">Try:</span>
            {suggestions.map((suggestion, index) => {
              const Icon = iconSuggestions[index];
              return (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void runSearch(suggestion)}
                  className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/40 bg-white px-4 text-sm font-bold text-[#00172b] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Icon className="h-5 w-5 text-[var(--secondary)]" aria-hidden="true" />
                  {suggestion}
                </button>
              );
            })}
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {status === 'listening'
              ? 'Listening. Activate the microphone again to stop.'
              : status === 'transcribing'
                ? 'Transcribing voice search.'
                : status === 'searching'
                  ? 'Searching.'
                  : error}
          </p>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {error} Typed search remains available.
        </p>
      ) : null}
      {response ? (
        <section className="mt-6" aria-label="Search results">
          <p className="text-sm font-bold text-[#52677c]">
            {response.results.length} results for “{response.query}”
          </p>
          {response.answer ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 text-[#00172b]">
              {response.answer}
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {response.results.map((result) => (
              <a
                key={result.id}
                href={result.url}
                target={result.url.startsWith('http') ? '_blank' : undefined}
                rel={result.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="rounded-2xl border border-[#00172b]/10 bg-white p-4 transition hover:border-[var(--primary)] hover:shadow-sm"
              >
                <span className="text-xs font-black uppercase tracking-wider text-[var(--team-primary-text)]">
                  {result.type.replace('_', ' ')}
                </span>
                <h3 className="mt-1 font-black text-[#00172b]">{result.title}</h3>
                {result.summary ? (
                  <p className="mt-2 line-clamp-2 text-sm text-[#52677c]">{result.summary}</p>
                ) : null}
                <span className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--team-primary-text)]">
                  View source <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PlaybookDecoration() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute -right-10 -top-16 h-[150%] w-[55%] text-white opacity-10"
      viewBox="0 0 700 400"
      fill="none"
    >
      <path
        d="M90 330C180 270 205 185 320 170S510 250 650 105"
        stroke="currentColor"
        strokeWidth="5"
        strokeDasharray="12 13"
      />
      <path d="m625 102 29 2-9 27" stroke="currentColor" strokeWidth="6" />
      <path
        d="M190 55 220 85M220 55l-30 30M480 45l36 36m0-36-36 36M535 280l34 34m0-34-34 34"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="130" cy="190" r="18" stroke="currentColor" strokeWidth="7" />
      <circle cx="390" cy="90" r="20" stroke="currentColor" strokeWidth="7" />
      <circle cx="625" cy="260" r="22" stroke="currentColor" strokeWidth="7" />
      <path d="M130 212v70l55 32m205-204v88l-40 34" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}
