import { CheckCircle2 } from 'lucide-react';

import type { StoryVerdict } from '@/features/realtime/types';

export default function Verdict({ verdict }: { verdict: StoryVerdict }) {
  return (
    <section className="rounded-3xl border-2 border-[var(--primary)] bg-white p-6 shadow-sm sm:p-8">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[var(--team-primary-text)]">
        <CheckCircle2 className="h-4 w-4" /> The Verdict
      </p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-3xl font-black uppercase tracking-tight">{verdict.label}</h2>
        <strong className="text-4xl font-black text-emerald-600">{verdict.positivePercent}%</strong>
      </div>
      <dl className="mt-7 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            The consensus
          </dt>
          <dd className="mt-1 text-lg font-bold">{verdict.consensus}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            The optimists say
          </dt>
          <dd className="mt-1 text-sm leading-6 text-slate-600">{verdict.optimists}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            The skeptics say
          </dt>
          <dd className="mt-1 text-sm leading-6 text-slate-600">{verdict.skeptics}</dd>
        </div>
        <div className="sm:col-span-2 rounded-2xl bg-slate-50 p-4">
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Smartest point being made
          </dt>
          <dd className="mt-1 font-bold">{verdict.smartestPoint}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Bottom line
          </dt>
          <dd className="mt-1 font-black text-[var(--team-primary-text)]">{verdict.bottomLine}</dd>
        </div>
      </dl>
    </section>
  );
}
