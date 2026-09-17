import AppShell from '@/components/app-shell';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';
import { FrontOfficeSettings } from '@/components/front-office/settings/FrontOfficeSettings';

export default function FrontOfficeSettingsPage() {
  return (
    <AppShell>
      <FrontOfficeStrategicHero
        section="Settings"
        title="Settings"
        description="Customize your Front Office experience and simulation preferences."
      />
      <FrontOfficeSettings />
    </AppShell>
  );
}
