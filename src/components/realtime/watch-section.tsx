import { ExternalLink, Play } from 'lucide-react';

import type { StoryVideo } from '@/features/realtime/types';

export default function WatchSection({
  videos,
  consensus,
}: {
  videos: StoryVideo[];
  consensus: string;
}) {
  const groups = videos.reduce((result, video) => {
    result.set(video.category, [...(result.get(video.category) ?? []), video]);
    return result;
  }, new Map<StoryVideo['category'], StoryVideo[]>());
  return (
    <section className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--team-secondary-on-dark)]">
        Film Room
      </p>
      <h2 className="mt-2 text-3xl font-black">Go deeper without hunting.</h2>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--team-secondary-on-dark)]">
          The 30-second take
        </p>
        <p className="mt-2 text-sm leading-6 text-white/70">{consensus}</p>
      </div>
      {[...groups].map(([category, items]) => (
        <div key={category} className="mt-7">
          <h3 className="text-xs font-black tracking-[0.16em] text-white/45">{category}</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {items
              .sort((a, b) => b.usefulnessScore - a.usefulnessScore)
              .map((video) => (
                <a
                  key={video.id}
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-2xl bg-white/[0.07] p-4 transition hover:bg-white/[0.12]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--team-on-secondary)]">
                      <Play className="h-4 w-4 fill-current" />
                    </span>
                    <span className="text-xs font-bold text-white/45">{video.duration}</span>
                  </div>
                  <p className="mt-5 font-black leading-5">{video.title}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-white/45">
                    {video.creator} <ExternalLink className="h-3 w-3" />
                  </p>
                </a>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
