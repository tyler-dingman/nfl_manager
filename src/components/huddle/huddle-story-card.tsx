import { ArrowRight } from 'lucide-react';

import EditorialVisual from '@/components/editorial/editorial-visual';
import type { EditorialStoryInput, EditorialVisualData } from '../../../packages/editorial-visual';

type HuddleStoryCardProps = {
  id: string;
  teamId: string;
  headline: string;
  summary: string;
  category: string;
  status?: string | null;
  sourceCount: number;
  updatedAt: string;
  materialUpdateCount?: number;
  lead?: boolean;
  onOpen?: () => void;
  visual?: EditorialVisualData;
};

const updateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export default function HuddleStoryCard({
  id,
  teamId,
  headline,
  summary,
  category,
  status,
  sourceCount,
  updatedAt,
  materialUpdateCount,
  lead = false,
  onOpen,
  visual,
}: HuddleStoryCardProps) {
  const story: EditorialStoryInput = {
    teamId,
    storyType: category,
    category,
    headline,
    summary,
    status,
  };
  const time = updateLabel(updatedAt);

  return (
    <button
      type="button"
      data-story-id={id}
      onClick={onOpen}
      disabled={!onOpen}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-[#00172B]/10 bg-[#fffdf8] text-left shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg disabled:cursor-default ${lead ? 'md:col-span-2 xl:row-span-2' : ''}`}
    >
      <EditorialVisual
        story={visual ? undefined : story}
        visual={visual}
        variant={lead ? 'hero' : 'card'}
        decorative
        className="w-full shrink-0"
      />
      <div className={`flex min-h-0 flex-1 flex-col ${lead ? 'p-6 sm:p-7' : 'p-5'}`}>
        <h3
          className={`${lead ? 'text-2xl sm:text-[1.75rem]' : 'text-lg'} font-black leading-tight tracking-[-0.025em] text-[#00172B]`}
        >
          {headline}
        </h3>
        <p className={`${lead ? 'text-base leading-7' : 'text-sm leading-6'} mt-2 text-[#40556b]`}>
          {summary}
        </p>
        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#7890a8]">
            {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
            {materialUpdateCount ? ` · ${materialUpdateCount} updates` : ''}
            {time ? ` · Updated ${time}` : ''}
          </p>
          <ArrowRight className="h-5 w-5 shrink-0 text-[var(--team-primary-text)] transition group-enabled:group-hover:translate-x-1" />
        </div>
      </div>
    </button>
  );
}
