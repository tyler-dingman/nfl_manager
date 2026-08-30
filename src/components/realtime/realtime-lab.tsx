'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Bell, ChevronDown, Shield } from 'lucide-react';

import { FiveWideLogo } from '@/components/branding/fivewide-logo';
import TeamThemeProvider from '@/components/team-theme-provider';
import { REALTIME_DEMO_CATCH_UP, REALTIME_DEMO_STORY } from '@/features/realtime/demo-data';
import { useTeamStore } from '@/features/team/team-store';
import BreakingNewsCard from './breaking-news-card';
import CatchMeUp from './catch-me-up';
import FanPulse from './fan-pulse';
import StoryTimeline from './story-timeline';
import Verdict from './verdict';
import WatchSection from './watch-section';

export default function RealtimeLab() {
  const teams = useTeamStore((state) => state.teams);
  const [selectedTeamId, setSelectedTeamId] = useState(
    teams.find((team) => team.abbr === 'KC')?.id ?? '',
  );
  const team = teams.find((candidate) => candidate.id === selectedTeamId);
  const [stage, setStage] = useState<'REPORTED' | 'DEVELOPING' | 'CONFIRMED'>('CONFIRMED');
  const story = {
    ...REALTIME_DEMO_STORY,
    status: stage,
    headline:
      stage === 'REPORTED'
        ? 'Chiefs reportedly acquiring CB Darius Vale in a trade'
        : REALTIME_DEMO_STORY.headline,
    sources:
      stage === 'REPORTED'
        ? REALTIME_DEMO_STORY.sources.slice(1, 2)
        : stage === 'DEVELOPING'
          ? REALTIME_DEMO_STORY.sources.slice(1)
          : REALTIME_DEMO_STORY.sources,
  };

  return (
    <TeamThemeProvider team={team}>
      <div className="min-h-screen bg-[#f3f5f7] text-slate-950">
        <header className="border-b border-white/10 bg-[var(--dark)] text-white">
          <div className="mx-auto flex min-h-24 max-w-[1440px] items-center gap-5 px-4 py-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="flex items-center gap-3 text-sm font-bold text-white/60 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <FiveWideLogo
              size={62}
              teamAbbr={team?.abbr}
              generic={!team}
              containerClassName="h-auto w-32 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0 sm:w-40"
              priority
            />
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <label className="relative">
                <span className="sr-only">Select team</span>
                <select
                  value={selectedTeamId}
                  onChange={(event) => setSelectedTeamId(event.target.value)}
                  className="appearance-none rounded-full border border-white/15 bg-white/10 py-2.5 pl-4 pr-9 text-sm font-black text-white"
                >
                  <option value="" className="text-slate-950">
                    NFL
                  </option>
                  {teams.map((item) => (
                    <option key={item.id} value={item.id} className="text-slate-950">
                      {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-white/60" />
              </label>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--primary)]">
                Realtime story lab
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                Know ball. Without living on your phone.
              </h1>
            </div>
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pl-4 text-xs font-black text-slate-500 shadow-sm">
              Story stage
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value as typeof stage)}
                className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
              >
                <option>REPORTED</option>
                <option>DEVELOPING</option>
                <option>CONFIRMED</option>
              </select>
            </label>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Simulated demo:</strong> This fictional story demonstrates progressive
            verification, audio, sentiment, and source UX. It is not current reporting.
          </div>
          <CatchMeUp data={REALTIME_DEMO_CATCH_UP} />
          <BreakingNewsCard story={story} />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <FanPulse pulse={story.fanPulse} />
            <StoryTimeline items={story.timeline} />
          </div>
          <WatchSection videos={story.videos} consensus={story.videoConsensus} />
          {story.verdict ? <Verdict verdict={story.verdict} /> : null}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <Shield className="mx-auto h-7 w-7 text-[var(--primary)]" />
            <h2 className="mt-3 text-xl font-black">Down & Distance is the understanding layer.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Every summary retains its original attribution. Reporting, videos, and fan discussion
              remain linked to their publishers and creators.
            </p>
          </section>
        </main>
      </div>
    </TeamThemeProvider>
  );
}
