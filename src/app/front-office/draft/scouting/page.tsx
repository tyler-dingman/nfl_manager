import AppShell from '@/components/app-shell';
import { DraftExperienceHero } from '@/components/draft/draft-experience-hero';
import { DraftGuidePage } from '@/components/draft/draft-guide-page';
import { getDraftProspectsForYear } from '@/server/data/draft-prospects';

export default function DraftGuideRoute() {
  return (
    <AppShell>
      <DraftExperienceHero
        title="Draft Guide"
        description="In-depth analysis, positional breakdowns, and expert insights to help you win draft day."
        active="draft-guide"
      />
      <DraftGuidePage prospects={getDraftProspectsForYear(2027)} />
    </AppShell>
  );
}
