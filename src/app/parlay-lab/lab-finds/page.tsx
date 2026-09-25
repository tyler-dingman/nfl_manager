import { Suspense } from 'react';
import ParlayLabExplorePage from '@/components/parlay-lab/ParlayLabExplorePage';

export default function LabFindsPage() {
  return (
    <Suspense>
      <ParlayLabExplorePage mode="lab-finds" />
    </Suspense>
  );
}
