import { notFound } from 'next/navigation';

import AccountScreen, { type AccountSection } from '@/components/auth/account-screen';

const sections = new Set<AccountSection>([
  'preferences',
  'my-team',
  'notifications',
  'content',
  'account',
  'devices',
  'privacy-security',
  'saved',
  'front-office',
  'security',
]);

export default function AccountSectionPage({ params }: { params: { section: string } }) {
  if (!sections.has(params.section as AccountSection)) notFound();
  return <AccountScreen section={params.section as AccountSection} />;
}
