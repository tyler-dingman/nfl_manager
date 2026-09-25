import DownDistanceHome from '@/components/down-distance-home';
import { Suspense } from 'react';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <DownDistanceHome />
    </Suspense>
  );
}
