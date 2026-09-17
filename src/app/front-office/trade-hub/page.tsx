import AppShell from '@/components/app-shell';
import { DraftExperienceHero } from '@/components/draft/draft-experience-hero';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import { TradeHubPage } from '@/components/front-office/trade-hub/TradeHubPage';

export default function TradeHubRoute({ searchParams }: { searchParams?: { context?: string } }) {
  const rosterContext = searchParams?.context === 'roster';
  return (
    <AppShell>
      {rosterContext ? (
        <>
          <FrontOfficeStrategicHero
            section="Trade Hub"
            title="Trade Hub"
            description="Explore the market, build offers, and reshape your roster through trades."
          />
          <FrontOfficeSectionNav section="roster" />
        </>
      ) : (
        <DraftExperienceHero
          title="Trade Machine"
          description="Build packages, evaluate value, and negotiate draft-day moves."
          active="trade-machine"
        />
      )}
      <div className="pt-4">
        <TradeHubPage />
      </div>
    </AppShell>
  );
}
