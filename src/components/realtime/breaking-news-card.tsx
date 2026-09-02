import { Radio } from 'lucide-react';

import type { RealtimeStory } from '@/features/realtime/types';
import AudioBreakdownPlayer from './audio-breakdown-player';
import SourceTrust from './source-trust';
import StoryFreshness from './story-freshness';
import StoryStatusBadge from './story-status-badge';
import ThreeAndOut from './three-and-out';
import EditorialVisual from '@/components/editorial/editorial-visual';

export default function BreakingNewsCard({ story }: { story: RealtimeStory }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <EditorialVisual
        story={{
          teamId: story.teamId,
          storyType: story.storyType,
          headline: story.headline,
          summary: story.summary,
          status: story.isBreaking ? 'BREAKING' : story.status,
        }}
        variant="hero"
        decorative
      />
      <div className="bg-[var(--dark)] p-6 text-[var(--team-on-dark)] sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em] text-[var(--team-secondary-on-dark)]">
            <Radio className="h-4 w-4" /> Breaking
          </span>
          <StoryStatusBadge status={story.status} />
          {story.demo ? (
            <span className="rounded-full border border-current/20 px-3 py-1 text-[10px] font-black tracking-wider text-[var(--team-on-dark)] opacity-75">
              SIMULATED DEMO
            </span>
          ) : null}
        </div>
        <h1 className="mt-5 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
          {story.headline}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--team-on-dark)] opacity-80">
          {story.summary}
        </p>
        <div className="mt-5 text-[var(--team-on-dark)] opacity-70">
          <StoryFreshness updatedAt={story.updatedAt} lastCheckedAt={story.lastCheckedAt} />
        </div>
      </div>
      <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <ThreeAndOut
            whatHappened={story.whatHappened}
            whyItMatters={story.whyItMatters}
            whatsNext={story.whatsNext}
          />
        </div>
        <div className="space-y-4">
          <SourceTrust
            sources={story.sources}
            trustLevel={story.trustLevel}
            lastCheckedAt={story.lastCheckedAt}
          />
          <AudioBreakdownPlayer audio={story.audio} />
        </div>
      </div>
    </article>
  );
}
