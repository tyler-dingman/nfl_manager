import { ArrowRight, Bookmark, Flame } from 'lucide-react';
import Link from 'next/link';
import ShareToCrewButton from '@/components/crew/share-to-crew-button';

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
  hotReadUntil?: string | null;
  firstReportedBy?: string | null;
  sources?: Array<{ id: string; publisher: string; title: string; url: string }>;
  lead?: boolean;
  saved?: boolean;
  onSave?: () => void;
  onOpen?: () => void;
};

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function isHotRead(hotReadUntil?: string | null, now = Date.now()) {
  return Boolean(hotReadUntil && new Date(hotReadUntil).getTime() > now);
}

export default function HuddleStoryCard({
  id,
  teamId,
  headline,
  summary,
  category,
  sourceCount,
  updatedAt,
  materialUpdateCount,
  hotReadUntil,
  firstReportedBy,
  sources = [],
  lead = false,
  saved = false,
  onSave,
  onOpen,
}: HuddleStoryCardProps) {
  const hotRead = isHotRead(hotReadUntil);
  const time = relativeTime(updatedAt);

  return (
    <article
      data-story-id={id}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-[#fffdf8] text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
        hotRead ? 'border-[var(--primary)]' : 'border-[#00172B]/10'
      } ${lead ? 'md:col-span-2' : ''}`}
    >
      <div
        className={`h-1.5 w-full ${hotRead ? 'bg-[var(--primary)]' : 'bg-[var(--secondary)]'}`}
      />
      <div className={`flex flex-1 flex-col ${lead ? 'p-6 sm:p-8' : 'p-5 sm:p-6'}`}>
        <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em]">
          <span
            className={`inline-flex items-center gap-1.5 ${hotRead ? 'text-[var(--team-primary-text)]' : 'text-[#52677c]'}`}
          >
            {hotRead ? <Flame className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> : null}
            {hotRead ? 'Hot Read' : category.replaceAll('_', ' ')}
          </span>
          {time ? <time className="text-[#7890a8]">{time}</time> : null}
        </div>

        <Link
          href={`/content/${encodeURIComponent(id)}`}
          onClick={onOpen}
          className="mt-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/30"
          aria-label={`Open story: ${headline}`}
        >
          <h3
            className={`${lead ? 'text-2xl sm:text-3xl' : 'text-xl'} font-black leading-tight tracking-[-0.025em] text-[#00172B]`}
          >
            {headline}
          </h3>
          <p
            className={`${lead ? 'text-base leading-7' : 'text-sm leading-6'} mt-3 text-[#40556b]`}
          >
            {summary}
          </p>
        </Link>

        {hotRead && firstReportedBy ? (
          <p className="mt-4 text-xs font-bold text-[#52677c]">
            First reported by <span className="text-[#00172B]">{firstReportedBy}</span>
          </p>
        ) : null}

        {sources.length ? (
          <details className="mt-4 border-t border-[#00172B]/10 pt-4 text-xs">
            <summary className="cursor-pointer font-black text-[var(--team-primary-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/30">
              View {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
            </summary>
            <div className="mt-3 space-y-2">
              {sources.map((source, index) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-3 rounded-lg bg-[#f7f4ee] p-3 font-bold text-[#00172B] hover:underline"
                >
                  <span>
                    {index === 0 && firstReportedBy === source.publisher
                      ? 'First reported by · '
                      : ''}
                    {source.publisher}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
              ))}
            </div>
          </details>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#7890a8]">
              {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
              {materialUpdateCount ? ` · ${materialUpdateCount} updates` : ''}
              {time ? ` · Updated ${time}${time === 'now' ? '' : ' ago'}` : ''}
            </p>
            {onSave ? (
              <button
                type="button"
                onClick={onSave}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-[var(--team-primary-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/30"
                aria-label={saved ? `Remove ${headline} from saved stories` : `Save ${headline}`}
              >
                <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
                {saved ? 'Saved' : 'Save'}
              </button>
            ) : null}
            <ShareToCrewButton
              contentId={id}
              contentType="BEAT_STORY"
              href={`/content/${encodeURIComponent(id)}`}
              title={headline}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-[var(--team-primary-text)]"
            />
          </div>
          <Link
            href={`/content/${encodeURIComponent(id)}`}
            onClick={onOpen}
            className="rounded-full p-2 text-[var(--team-primary-text)] transition group-hover:translate-x-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/30"
            aria-label={`Open story: ${headline}`}
          >
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
