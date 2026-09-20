import AppShell from '@/components/app-shell';
import { DraftExperienceHero } from '@/components/draft/draft-experience-hero';
import { ProspectBoard } from '@/components/draft/prospect-board';
import { getDraftProspectsForYear } from '@/server/data/draft-prospects';
export default function ProspectDetail({ params }: { params: { prospectId: string } }) {
  return (
    <AppShell>
      <DraftExperienceHero
        title="Position Rankings"
        description="Compare the draft class by position, grade, and projected value."
        active="position-rankings"
      />
      <ProspectBoard
        prospects={getDraftProspectsForYear(2027)}
        initialProspectId={params.prospectId}
      />
    </AppShell>
  );
}
