import { ArrowUpRight, CircleDot, Play, Trophy } from 'lucide-react';

import type { PromoConcept } from '@/features/promos/concepts';
import SponsorLockup from './sponsor-lockup';

export default function PromoConceptCard({
  concept,
  number,
}: {
  concept: PromoConcept;
  number: number;
}) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#111827]/10 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between p-7 sm:p-10">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-[0.2em] text-[#FF3D38]">
                CONCEPT {String(number).padStart(2, '0')}
              </span>
              <CircleDot className="h-5 w-5 text-[#FF3D38]" />
            </div>
            <p className="mt-10 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              {concept.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-[-0.04em] sm:text-6xl">
              {concept.property}
            </h2>
            <div className="mt-5 text-[#00172B]">
              <SponsorLockup sponsor={concept.sponsor} logoPath={concept.logoPath} />
            </div>
            <p className="mt-8 max-w-lg text-base leading-7 text-slate-600">
              {concept.description}
            </p>
          </div>
          <blockquote className="mt-12 border-l-4 border-[#FF3D38] pl-4 text-lg font-black italic">
            “{concept.campaignLine}”
          </blockquote>
        </div>
        <div
          className="relative overflow-hidden p-6 text-white sm:p-8"
          style={{ backgroundColor: concept.surface }}
        >
          <div
            className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[40px] opacity-10"
            style={{ borderColor: concept.accent }}
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-55">
                  Live placement mockup
                </p>
                <h3 className="mt-2 text-2xl font-black">{concept.property}</h3>
              </div>
              <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-black">
                WEEK 12
              </span>
            </div>
            <div
              className={`mt-7 grid gap-3 ${concept.stats.length === 4 ? 'grid-cols-2' : 'sm:grid-cols-3'}`}
            >
              {concept.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"
                >
                  <p className="text-[10px] font-black uppercase tracking-wider opacity-50">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-lg font-black" style={{ color: concept.accent }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-white p-5 text-[#00172B]">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#FF3D38]">
                <Trophy className="h-4 w-4" /> {concept.featureTitle}
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-400">
                {concept.featureLabel}
              </p>
              <p className="mt-2 font-bold leading-6">{concept.featureCopy}</p>
              {concept.secondaryLabel ? (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                    {concept.secondaryLabel}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{concept.secondaryCopy}</p>
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black text-[#00172B]"
                style={{ backgroundColor: concept.accent }}
              >
                <Play className="h-3.5 w-3.5 fill-current" /> Open module
              </button>
              <ArrowUpRight className="h-5 w-5 opacity-45" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
