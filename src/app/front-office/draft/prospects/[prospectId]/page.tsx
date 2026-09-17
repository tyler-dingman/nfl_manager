import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AppShell from '@/components/app-shell';
import { DraftExperienceHero } from '@/components/draft/draft-experience-hero';
import { getDraftProspectsForYear } from '@/server/data/draft-prospects';
export default function ProspectDetail({ params }: { params: { prospectId: string } }) {
  const prospect = getDraftProspectsForYear(2027).find((entry) => entry.id === params.prospectId);
  return (
    <AppShell>
      <DraftExperienceHero
        title="Position Rankings"
        description="Compare the draft class by position, grade, and projected value."
        active="position-rankings"
      />
      <div className="mx-auto max-w-5xl pt-4">
        <Link
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--fo-interactive-text)]"
          href="/front-office/draft/prospects"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Prospects
        </Link>
        {prospect ? (
          <>
            <header className="rounded-lg border bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--fo-interactive-text)]">
                Rank #{prospect.ranking} · {prospect.projectedRange}
              </p>
              <h2 className="mt-2 font-[var(--font-headline)] text-5xl font-black uppercase">
                {prospect.name}
              </h2>
              <p className="mt-2 text-slate-600">
                {prospect.position} · {prospect.school} · {prospect.height ?? '—'} ·{' '}
                {prospect.weight ? `${prospect.weight} lbs` : '—'} · Age {prospect.age ?? '—'}
              </p>
            </header>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <section className="rounded-lg border bg-white p-5 md:col-span-2">
                <h2 className="font-[var(--font-headline)] text-2xl font-black uppercase">
                  Scouting overview
                </h2>
                <p className="mt-3 leading-7 text-slate-700">
                  {prospect.summary ??
                    'Scouting information will sharpen as the season, all-star circuit, and testing calendar progress.'}
                </p>
              </section>
              <section className="rounded-lg border bg-white p-5">
                <h2 className="font-[var(--font-headline)] text-xl font-black uppercase">
                  Projection
                </h2>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Grade</dt>
                    <dd className="font-bold">{prospect.grade ?? 'Developing'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Expected range</dt>
                    <dd className="font-bold">{prospect.projectedRange ?? 'To be determined'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Class</dt>
                    <dd className="font-bold">{prospect.classYear ?? '—'}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </>
        ) : (
          <section className="rounded-lg border bg-white p-8">Prospect not found.</section>
        )}
      </div>
    </AppShell>
  );
}
