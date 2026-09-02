import { notFound } from 'next/navigation';

import EditorialVisual from '@/components/editorial/editorial-visual';
import { EDITORIAL_VISUAL_FIXTURES } from '@/features/content/editorial-visual-fixtures';

export default function EditorialVisualsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const teams = ['CIN', 'KC', 'BUF', 'BAL', 'GB', 'MIA', 'DAL', 'LV', 'PIT', 'SF'];
  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-10 text-[#00172B]">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-black uppercase tracking-[.22em] text-[#FF3D38]">
          Development fixtures · Not production content
        </p>
        <h1 className="mt-3 text-4xl font-black">Huddle Editorial Card System</h1>
        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {EDITORIAL_VISUAL_FIXTURES.map((visual) => (
            <div key={visual.visualType}>
              <p className="mb-2 text-xs font-black">{visual.visualType}</p>
              <EditorialVisual visual={visual} />
            </div>
          ))}
        </section>
        <h2 className="mt-14 text-2xl font-black">Representative team palettes</h2>
        <section className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {teams.map((teamId) => (
            <EditorialVisual
              key={teamId}
              visual={{ ...EDITORIAL_VISUAL_FIXTURES[6], teamId }}
              variant="compact"
            />
          ))}
        </section>
      </div>
    </main>
  );
}
