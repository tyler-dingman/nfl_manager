import AppShell from '@/components/app-shell';
import { FrontOfficeMessages } from '@/components/front-office/front-office-messages';
import { FrontOfficeStrategicHero } from '@/components/front-office/front-office-strategic-hero';

export default function FrontOfficeMessagesPage() {
  return (
    <AppShell>
      <FrontOfficeStrategicHero
        section="Messages"
        title="Messages"
        description="Review updates from your coaches, players, and football operations staff."
      />
      <FrontOfficeMessages />
    </AppShell>
  );
}
