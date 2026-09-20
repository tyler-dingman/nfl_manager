import { Suspense } from 'react';
import { ParlayLabHome } from '@/components/parlay-lab/ParlayLabHome';

export const metadata = {
  title: 'The Parlay Bus | Down & Distance',
  description: 'Find the trends. Build your slip.',
};

export default function Page() {
  return (
    <Suspense>
      <ParlayLabHome />
    </Suspense>
  );
}
