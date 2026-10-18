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

export default async function AccountSectionPage({ params: asyncparams }: { params: Promise<{ section: string }> }) {
const params = await asyncparams;

  if (!sections.has(params.section as AccountSection)) notFound();
  return <AccountScreen section={params.section as AccountSection} />;
}
