import AppShell from '@/components/app-shell';
import { DraftExperienceHero } from '@/components/draft/draft-experience-hero';
import { DraftCentralPage } from '@/components/front-office/draft-central/DraftCentralPage';
export default function DraftCentralRoute() {
  return (
    <AppShell>
      <DraftExperienceHero
        title="Draft Central"
        description="Scouting, analysis, projections, and everything you need to prepare for the next draft."
        active="draft-central"
      />
      <DraftCentralPage />
    </AppShell>
  );
}
