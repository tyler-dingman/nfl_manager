import AppShell from '@/components/app-shell';
import { DraftExperienceHero } from '@/components/draft/draft-experience-hero';
import { ProspectBoard } from '@/components/draft/prospect-board';
import { getDraftProspectsForYear } from '@/server/data/draft-prospects';
import { draftPositionFilter } from '@/lib/draft-position-filter';

export default async function DraftProspectsPage({
  searchParams: asyncsearchParams,
}: {
  searchParams?: Promise<{ position?: string | string[] }>;
}) {
const searchParams = await asyncsearchParams;

  const requestedPosition = searchParams?.position;
  const position = draftPositionFilter(
    Array.isArray(requestedPosition) ? requestedPosition[0] : requestedPosition,
  );
  return (
    <AppShell>
      <DraftExperienceHero
        title="Position Rankings"
        description="Compare the draft class by position, grade, and projected value."
        active="position-rankings"
      />
      <div className="pt-4">
        <ProspectBoard
          prospects={getDraftProspectsForYear(2027)}
          title="Prospects"
          showHeader={false}
          initialPosition={position}
        />
      </div>
    </AppShell>
  );
}
