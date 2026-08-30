import { Suspense } from 'react';

import TeamContentHub from '@/components/team-content-hub';

export default function WirePage() {
  return (
    <Suspense>
      <TeamContentHub kind="wire" />
    </Suspense>
  );
}
