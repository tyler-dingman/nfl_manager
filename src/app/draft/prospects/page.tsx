import AppShell from '@/components/app-shell';
import { ProspectBoard } from '@/components/draft/prospect-board';
import { getDraftProspectsForYear } from '@/server/data/draft-prospects';

export default function DraftProspectsPage() {
  return (
    <AppShell>
      <ProspectBoard prospects={getDraftProspectsForYear(2027)} title="Prospects" />
    </AppShell>
  );
}
