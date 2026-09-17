import AppShell from '@/components/app-shell';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import { FrontOfficeStandingsPage } from '@/components/front-office/standings/FrontOfficeStandingsPage';

export default function StandingsPage() {
  return (
    <AppShell>
      <FrontOfficeStrategicHero
        section="Standings"
        title="Standings"
        description="Track the playoff race and see where every team stands."
      />
      <FrontOfficeSectionNav section="league" />
      <FrontOfficeStandingsPage />
    </AppShell>
  );
}
