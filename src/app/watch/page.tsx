import { Suspense } from 'react';

import TeamContentHub from '@/components/team-content-hub';

export default function WatchPage() {
  return (
    <Suspense>
      <TeamContentHub kind="watch" />
    </Suspense>
  );
}
