import AppShell from '@/components/app-shell';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
export default function OwnershipLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <FrontOfficeStrategicHero
        section="Ownership"
        title="Ownership"
        description="Build the future. Invest in your team, your city, and your legacy."
      />
      <FrontOfficeSectionNav section="ownership" />
      {children}
    </AppShell>
  );
}
