import AppShell from '@/components/app-shell';
import { DraftExperienceHero } from '@/components/draft/draft-experience-hero';
import { ProspectBoard } from '@/components/draft/prospect-board';
import { getDraftProspectsForYear } from '@/server/data/draft-prospects';
import { draftPositionFilter } from '@/lib/draft-position-filter';

export default function DraftProspectsPage({
  searchParams,
}: {
  searchParams?: { position?: string | string[] };
}) {
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
