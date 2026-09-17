import AppShell from '@/components/app-shell';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import { FrontOfficeSchedulePage } from '@/components/front-office/schedule/FrontOfficeSchedulePage';

export default function SchedulePage() {
  return (
    <AppShell>
      <FrontOfficeStrategicHero
        section="Schedule"
        title="Schedule"
        description="Follow the season week by week and prepare for what comes next."
      />
      <FrontOfficeSectionNav section="league" />
      <FrontOfficeSchedulePage />
    </AppShell>
  );
}
