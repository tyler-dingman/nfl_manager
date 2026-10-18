import AppShell from '@/components/app-shell';
import { DraftExperienceHero } from '@/components/draft/draft-experience-hero';
import { ProspectBoard } from '@/components/draft/prospect-board';
import { getDraftProspectsForYear } from '@/server/data/draft-prospects';
export default async function ProspectDetail({ params: asyncparams }: { params: Promise<{ prospectId: string }> }) {
const params = await asyncparams;

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
