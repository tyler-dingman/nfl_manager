import { Suspense } from 'react';
import { ParlayLabHome } from '@/components/parlay-lab/ParlayLabHome';

export const metadata = {
  title: 'Parlay Lab | Down & Distance',
  description: 'Find the trends. Build your slip.',
};

export default function Page() {
  return (
    <Suspense>
      <ParlayLabHome />
    </Suspense>
  );
}
