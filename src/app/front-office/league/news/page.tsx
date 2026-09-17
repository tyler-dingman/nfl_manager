import AppShell from '@/components/app-shell';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import { LeagueNewsPage } from '@/components/front-office/news-graphics/LeagueNewsPage';

export default function FrontOfficeLeagueNewsPage() {
  return (
    <AppShell>
      <FrontOfficeStrategicHero
        section="League News"
        title="League News"
        description="Follow the latest moves, injuries, rumors, and storylines from around your league."
      />
      <FrontOfficeSectionNav section="league" />
      <LeagueNewsPage />
    </AppShell>
  );
}
