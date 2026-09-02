import { Suspense } from 'react';

import TeamContentHub from '@/components/team-content-hub';

export default function ThreeAndOutPage() {
  return (
    <Suspense>
      <TeamContentHub kind="three-and-out" />
    </Suspense>
  );
}
