import { Suspense } from 'react';

import TeamContentHub from '@/components/team-content-hub';

export default function HuddlePage() {
  return (
    <Suspense>
      <TeamContentHub kind="huddle" />
    </Suspense>
  );
}
