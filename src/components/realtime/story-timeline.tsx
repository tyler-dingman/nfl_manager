import type { TimelineItem } from '@/features/realtime/types';
import StoryStatusBadge from './story-status-badge';

export default function StoryTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--team-primary-text)]">
        Story timeline
      </p>
      <ol className="mt-6 space-y-0">
        {items.map((item, index) => (
          <li key={item.id} className="grid grid-cols-[58px_20px_1fr] gap-3">
            <time className="pt-0.5 text-xs font-black text-slate-400">{item.time}</time>
            <span className="relative flex justify-center">
              <span className="z-10 mt-1 h-3 w-3 rounded-full bg-[var(--primary)] ring-4 ring-white" />
              {index < items.length - 1 ? (
                <span className="absolute bottom-0 top-3 w-px bg-slate-200" />
              ) : null}
            </span>
            <div className="pb-7">
              <p className="text-sm font-bold leading-5">{item.label}</p>
              <div className="mt-2">
                <StoryStatusBadge status={item.status} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
