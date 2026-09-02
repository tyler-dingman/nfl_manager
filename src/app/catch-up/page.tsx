import { Suspense } from 'react';

import CatchUpExperience from '@/components/catch-up/catch-up-experience';

export default function CatchUpPage() {
  return (
    <Suspense>
      <CatchUpExperience />
    </Suspense>
  );
}
