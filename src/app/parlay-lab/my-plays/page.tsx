import { Suspense } from 'react';
import MyPlaysPage from '@/components/parlay-lab/MyPlaysPage';

export default function Page() {
  return (
    <Suspense>
      <MyPlaysPage />
    </Suspense>
  );
}
