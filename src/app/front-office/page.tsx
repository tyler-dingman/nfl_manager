import { Suspense } from 'react';

import TeamContentHub from '@/components/team-content-hub';

export default function FrontOfficePage() {
  return (
    <Suspense>
      <TeamContentHub kind="front-office" />
    </Suspense>
  );
}
