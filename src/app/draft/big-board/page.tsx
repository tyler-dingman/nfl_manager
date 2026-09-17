import AppShell from '@/components/app-shell';
import { DraftExperienceHero } from '@/components/draft/draft-experience-hero';
import { ProspectBoard } from '@/components/draft/prospect-board';
import { getDraftProspectsForYear } from '@/server/data/draft-prospects';

export default function DraftBigBoardPage() {
  return (
    <AppShell>
      <DraftExperienceHero
        title="Big Board"
        description="Rank the draft class and track the best available prospects."
        active="big-board"
      />
      <div className="pt-4">
        <ProspectBoard prospects={getDraftProspectsForYear(2027)} showHeader={false} />
      </div>
    </AppShell>
  );
}
