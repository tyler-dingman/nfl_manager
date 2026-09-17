'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import AppShell from '@/components/app-shell';
import { FrontOfficePageHeader } from '@/components/front-office/front-office-page-header';
import { FrontOfficeSectionNav } from '@/components/front-office/front-office-section-nav';
import { LeagueNewsPage } from '@/components/front-office/news-graphics/LeagueNewsPage';

export default function LeaguePage() {
  return (
    <Suspense fallback={null}>
      <LeaguePageContent />
    </Suspense>
  );
}

function LeaguePageContent() {
  const searchParams = useSearchParams();
  const transactionsOnly = searchParams?.get('view') === 'transactions';

  return (
    <AppShell>
      <FrontOfficePageHeader
        title={transactionsOnly ? 'Transactions' : 'League Central'}
        description={
          transactionsOnly
            ? 'Track trades, signings, releases, and roster movement from around the league.'
            : 'Follow the latest moves, injuries, rumors, and storylines from around your league.'
        }
      />
      <FrontOfficeSectionNav section="league" />
      <LeagueNewsPage initialCategory={transactionsOnly ? 'TRANSACTION' : 'ALL'} />
    </AppShell>
  );
}
