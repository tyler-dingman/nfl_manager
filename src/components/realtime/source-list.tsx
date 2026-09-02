import { ExternalLink, ShieldCheck } from 'lucide-react';

import type { StorySource } from '@/features/realtime/types';

export default function SourceList({
  sources,
  lastCheckedAt,
}: {
  sources: StorySource[];
  lastCheckedAt: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em]">
          <ShieldCheck className="h-4 w-4 text-emerald-600" /> Sources
        </h3>
        <span className="text-xs text-slate-400">
          Checked {new Date(lastCheckedAt).toLocaleTimeString()}
        </span>
      </div>
      <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
        {sources.map((source) => (
          <li key={source.id}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between gap-4 py-4"
            >
              <span>
                <span className="block font-black text-slate-900">{source.name}</span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">
                  {source.role} · Trust tier {source.trustTier}
                </span>
              </span>
              <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-[var(--team-primary-text)]" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
